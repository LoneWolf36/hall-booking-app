import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/services/cache.service';
import { RazorpayService } from './services/razorpay.service';
import {
  CreatePaymentLinkDto,
  PaymentLinkResponseDto,
  RazorpayWebhookDto,
} from './dto/create-payment-link.dto';

/**
 * Payment Service - Orchestrates payment operations with Razorpay integration
 *
 * Core Responsibilities:
 * 1. Create payment links for bookings (deposit or full amount)
 * 2. Handle Razorpay webhook events for payment status updates
 * 3. Update booking status based on payment completion
 * 4. Manage payment records in database with audit trail
 * 5. Cache payment data for performance
 *
 * Payment Flow:
 * 1. Booking created in temp_hold/pending status
 * 2. Payment link generated via Razorpay API
 * 3. Payment record created in DB with pending status
 * 4. Booking status updated to pending (if was temp_hold)
 * 5. Customer completes payment (external Razorpay page)
 * 6. Razorpay sends webhook to our endpoint
 * 7. Webhook handler updates payment and booking status
 * 8. Booking confirmed, hold cleared, cache invalidated
 *
 * Webhook Events Handled:
 * - payment_link.paid: Payment successful
 * - payment_link.expired: Payment link expired
 * - payment_link.cancelled: Payment link cancelled
 * - payment.captured: Payment captured by gateway
 * - payment.failed: Payment attempt failed
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly PAYMENT_CACHE_TTL = 1800; // 30 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * Create Razorpay payment link for booking online payment portion.
   *
   * **Business Logic**:
   * - Only allows payment for temp_hold or pending status bookings
   * - Checks hold expiration - rejects if already expired
   * - Prevents duplicate payment links for same booking
   * - Transitions temp_hold bookings to pending status
   *
   * **Razorpay Integration**:
   * - Creates payment link with customer details
   * - Sets expiry based on booking holdExpiresAt
   * - Includes metadata for webhook processing
   * - Returns short URL for customer payment
   *
   * **Side Effects**:
   * - Writes to `payments` table with provider='razorpay'
   * - Updates booking status: temp_hold → pending
   * - Caches payment record (TTL: 30 minutes)
   *
   * **State Transitions**:
   * - Booking: temp_hold → pending
   * - Payment: created with status='pending'
   *
   * @param tenantId - Tenant UUID for multi-tenant isolation
   * @param bookingId - UUID of booking requiring payment
   *
   * @returns PaymentLinkResponseDto containing:
   *   - id: Razorpay payment link ID
   *   - shortUrl: Shareable payment URL for customer
   *   - amount: Payment amount in smallest currency unit (paisa)
   *   - currency: Currency code (default: INR)
   *   - expireBy: Unix timestamp when link expires
   *   - paymentId: Our internal payment record UUID
   *
   * @throws {NotFoundException} - Booking not found or not in payable status
   * @throws {BadRequestException} - Booking hold expired or invalid state
   * @throws {ConflictException} - Payment already exists for booking
   * @throws {InternalServerErrorException} - Razorpay API failure
   *
   * @example
   * ```typescript
   * const paymentLink = await paymentsService.createPaymentLinkForBooking(
   *   tenantId,
   *   'booking-uuid-here'
   * );
   * // Returns: { shortUrl: 'rzp.io/l/abc123', amount: 50000, ... }
   * ```
   */
  async createPaymentLinkForBooking(
    tenantId: string,
    bookingId: string,
  ): Promise<PaymentLinkResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Creating payment link for booking ${bookingId}`);

    try {
      // 1. Fetch booking with user and venue details
      const booking = await this.prisma.booking.findFirst({
        where: {
          id: bookingId,
          tenantId,
          status: { in: ['temp_hold', 'pending'] }, // Only allow payment for these statuses
        },
        include: {
          user: true,
          venue: true,
        },
      });

      if (!booking) {
        throw new NotFoundException({
          message: 'Booking not found or not eligible for payment',
          details: 'Booking must be in temp_hold or pending status',
          code: 'BOOKING_NOT_FOUND',
        });
      }

      // 2. Check if booking has expired
      if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
        throw new BadRequestException({
          message: 'Booking hold has expired',
          details: 'Please create a new booking',
          code: 'BOOKING_EXPIRED',
        });
      }

      // 3. Check if payment already exists
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          bookingId,
          tenantId,
          status: { in: ['pending', 'success'] },
        },
      });

      if (existingPayment) {
        throw new ConflictException({
          message: 'Payment already initiated for this booking',
          details: 'Use existing payment link or cancel previous payment',
          code: 'PAYMENT_EXISTS',
        });
      }

      // 4. Prepare payment link data
      const paymentLinkDto: CreatePaymentLinkDto = {
        bookingId,
        amountCents: booking.totalAmountCents || 0,
        currency: booking.currency,
        description: `Payment for ${booking.venue.name} - Booking #${booking.bookingNumber}`,
        customerName: booking.user.name,
        customerPhone: booking.user.phone,
        customerEmail: booking.user.email || undefined,
        expiresAt: booking.holdExpiresAt?.toISOString(),
        metadata: {
          venueId: booking.venueId,
          venueName: booking.venue.name,
          eventType: booking.eventType,
          bookingNumber: booking.bookingNumber,
        },
      };

      // 5. Create payment link via Razorpay
      const paymentLink =
        await this.razorpayService.createPaymentLink(paymentLinkDto);

      // 6. Create payment record in database
      const payment = await this.prisma.payment.create({
        data: {
          tenantId,
          bookingId,
          provider: 'razorpay',
          providerPaymentId: paymentLink.id,
          amountCents: paymentLink.amount,
          currency: paymentLink.currency,
          status: 'pending',
          gatewayResponse: {
            paymentLinkId: paymentLink.id,
            shortUrl: paymentLink.shortUrl,
            expireBy: paymentLink.expireBy,
            createdAt: new Date().toISOString(),
          },
        },
      });

      // 7. Update booking status to pending (if it was temp_hold)
      if (booking.status === 'temp_hold') {
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'pending' },
        });
      }

      // 8. Cache payment link
      await this.cacheService.set(
        `payment:${payment.id}`,
        payment,
        this.PAYMENT_CACHE_TTL,
      );

      const duration = Date.now() - startTime;
      this.logger.log(`Payment link created successfully in ${duration}ms`, {
        paymentId: payment.id,
        paymentLinkId: paymentLink.id,
        shortUrl: paymentLink.shortUrl,
      });

      return {
        ...paymentLink,
        paymentId: payment.id,
      };
    } catch (error) {
      this.logger.error('Failed to create payment link', {
        error: error.message,
        bookingId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Handle Razorpay webhook events for payment status updates.
   *
   * **Webhook Security**:
   * - Signature verification performed by controller before calling this method
   * - Uses Razorpay webhook secret for HMAC validation
   * - Rejects requests with invalid signatures
   *
   * **Event Routing**:
   * - Delegates to specific handlers based on event type
   * - Idempotent processing - safe to replay events
   * - Returns success even for unhandled events (acknowledgement)
   *
   * **Database Updates**:
   * - Updates payment status (pending → success/failed)
   * - Updates booking status (pending → confirmed or expired)
   * - Clears booking hold expiration on success
   * - Records gateway response for audit trail
   *
   * **Cache Invalidation**:
   * - Clears payment cache entry
   * - Clears booking cache entry
   * - Ensures fresh data on next API call
   *
   * **Handled Events**:
   * - payment_link.paid: Payment successful → confirm booking
   * - payment_link.expired: Link expired → mark booking expired
   * - payment_link.cancelled: Link cancelled → mark payment failed
   * - payment.captured: Payment captured (additional processing)
   * - payment.failed: Payment failed (additional processing)
   *
   * @param webhookPayload - Razorpay webhook event object:
   *   - event: Event type string (e.g., 'payment_link.paid')
   *   - payload: Event-specific data including payment_link and payment entities
   *
   * @returns Processing result:
   *   - success: true if event processed successfully
   *   - message: Description of action taken
   *
   * @throws {NotFoundException} - Payment record not found for payment link ID
   * @throws {Error} - Database update failures propagated to controller
   *
   * @example
   * ```typescript
   * const result = await paymentsService.handleWebhook({
   *   event: 'payment_link.paid',
   *   payload: {
   *     payment_link: { entity: { id: 'plink_xxx' } },
   *     payment: { entity: { id: 'pay_xxx' } }
   *   }
   * });
   * // Returns: { success: true, message: 'Payment processed for booking...' }
   * ```
   */
  async handleWebhook(
    webhookPayload: RazorpayWebhookDto,
  ): Promise<{ success: boolean; message: string }> {
    const { event, payload } = webhookPayload;

    this.logger.log(`Processing webhook event: ${event}`, {
      paymentLinkId: payload.payment_link?.entity?.id,
      paymentId: payload.payment?.entity?.id,
    });

    try {
      switch (event) {
        case 'payment_link.paid':
          return await this.handlePaymentLinkPaid(payload);

        case 'payment_link.expired':
          return await this.handlePaymentLinkExpired(payload);

        case 'payment_link.cancelled':
          return await this.handlePaymentLinkCancelled(payload);

        case 'payment.captured':
          return await this.handlePaymentCaptured(payload);

        case 'payment.failed':
          return await this.handlePaymentFailed(payload);

        default:
          this.logger.log(`Unhandled webhook event: ${event}`);
          return {
            success: true,
            message: 'Event acknowledged but not processed',
          };
      }
    } catch (error) {
      this.logger.error('Webhook processing failed', {
        event,
        error: error.message,
        paymentLinkId: payload.payment_link?.entity?.id,
      });
      throw error;
    }
  }

  /**
   * Handle payment_link.paid webhook event.
   *
   * **Actions Performed**:
   * 1. Find payment record by Razorpay payment link ID
   * 2. Update payment status to 'success' with gateway response
   * 3. Update booking status to 'confirmed'
   * 4. Set booking paymentStatus to 'paid'
   * 5. Clear booking holdExpiresAt (no longer needed)
   * 6. Invalidate caches for payment and booking
   *
   * **State Transitions**:
   * - Payment: pending → success
   * - Booking: pending → confirmed, paymentStatus: pending → paid
   *
   * @param payload - Webhook payload containing payment link and payment entities
   *
   * @returns Success message with booking number
   *
   * @throws {NotFoundException} - Payment not found for payment link
   *
   * @private
   */
  private async handlePaymentLinkPaid(
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    const paymentLinkId = payload.payment_link.entity.id;
    const paymentEntity = payload.payment?.entity;

    // Find payment record
    const payment = await this.prisma.payment.findFirst({
      where: {
        providerPaymentId: paymentLinkId,
      },
      include: {
        booking: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment not found for payment link ${paymentLinkId}`,
      );
    }

    // Update payment record
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'success',
        processedAt: new Date(),
        gatewayResponse: {
          ...(payment.gatewayResponse as any),
          paymentEntity,
          paidAt: new Date().toISOString(),
        },
      },
    });

    // Update booking status to confirmed
    await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: 'confirmed',
        paymentStatus: 'paid',
        holdExpiresAt: null, // Clear hold expiry
      },
    });

    // Clear relevant caches
    await this.cacheService.delete(`payment:${payment.id}`);
    await this.cacheService.delete(`booking:${payment.bookingId}`);

    this.logger.log('Payment processed successfully', {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      bookingNumber: payment.booking.bookingNumber,
    });

    return {
      success: true,
      message: `Payment processed for booking ${payment.booking.bookingNumber}`,
    };
  }

  /**
   * Handle payment_link.expired webhook event.
   *
   * **Actions Performed**:
   * 1. Find payment record by payment link ID
   * 2. Update payment status to 'failed'
   * 3. Update booking status to 'expired'
   * 4. Invalidate caches
   *
   * @param payload - Webhook payload with expired payment link
   *
   * @returns Success message
   *
   * @private
   */
  private async handlePaymentLinkExpired(
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    const paymentLinkId = payload.payment_link.entity.id;

    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: paymentLinkId },
      include: { booking: true },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });

      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'expired' },
      });

      await this.cacheService.delete(`payment:${payment.id}`);
      await this.cacheService.delete(`booking:${payment.bookingId}`);
    }

    return { success: true, message: 'Payment link expiry processed' };
  }

  /**
   * Handle payment_link.cancelled webhook event.
   *
   * **Actions Performed**:
   * 1. Find payment record by payment link ID
   * 2. Update payment status to 'failed'
   * 3. Invalidate payment cache
   *
   * Note: Does not update booking status - customer may retry payment
   *
   * @param payload - Webhook payload with cancelled payment link
   *
   * @returns Success message
   *
   * @private
   */
  private async handlePaymentLinkCancelled(
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    const paymentLinkId = payload.payment_link.entity.id;

    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: paymentLinkId },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });

      await this.cacheService.delete(`payment:${payment.id}`);
    }

    return { success: true, message: 'Payment link cancellation processed' };
  }

  /**
   * Handle payment.captured webhook event.
   *
   * Additional processing for captured payments beyond payment_link.paid.
   * Currently a no-op but available for future use (e.g., analytics, notifications).
   *
   * @param payload - Webhook payload with captured payment
   *
   * @returns Acknowledgement message
   *
   * @private
   */
  private async handlePaymentCaptured(
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    // Additional processing if needed for captured payments
    return { success: true, message: 'Payment capture processed' };
  }

  /**
   * Handle payment.failed webhook event.
   *
   * Additional processing for failed payment attempts.
   * Currently a no-op but available for future use (e.g., retry logic, notifications).
   *
   * @param payload - Webhook payload with failed payment
   *
   * @returns Acknowledgement message
   *
   * @private
   */
  private async handlePaymentFailed(
    payload: any,
  ): Promise<{ success: boolean; message: string }> {
    // Additional processing if needed for failed payments
    return { success: true, message: 'Payment failure processed' };
  }

  /**
   * Retrieve payment details by payment ID with booking and user information.
   *
   * **Included Relations**:
   * - booking: Booking details
   * - booking.user: Customer who made booking
   * - booking.venue: Venue details
   *
   * Used for:
   * - Payment status lookup
   * - Admin payment management
   * - Customer payment history
   *
   * @param tenantId - Tenant UUID for multi-tenant isolation
   * @param paymentId - UUID of payment to retrieve
   *
   * @returns Payment entity with full relations or null if not found
   *
   * @throws Never throws - returns null for not found
   */
  async getPaymentById(tenantId: string, paymentId: string): Promise<any> {
    return await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId,
      },
      include: {
        booking: {
          include: {
            user: true,
            venue: true,
          },
        },
      },
    });
  }
}
