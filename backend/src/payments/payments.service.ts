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
import { CreatePaymentLinkDto, PaymentLinkResponseDto, RazorpayWebhookDto } from './dto/create-payment-link.dto';

/**
 * Payment Service - Orchestrates payment operations
 * 
 * Responsibilities:
 * 1. Create payment links for bookings
 * 2. Handle webhook events from Razorpay
 * 3. Update booking status based on payment status
 * 4. Manage payment records in database
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
   * Create payment link for a booking
   * 
   * @param tenantId Tenant identifier
   * @param bookingId Booking UUID
   * @returns Payment link details
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
      const paymentLink = await this.razorpayService.createPaymentLink(paymentLinkDto);

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
        this.PAYMENT_CACHE_TTL
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
   * Handle Razorpay webhook events
   * 
   * @param webhookPayload Webhook data from Razorpay
   * @returns Processing result
   */
  async handleWebhook(webhookPayload: RazorpayWebhookDto): Promise<{ success: boolean; message: string }> {
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
          return { success: true, message: 'Event acknowledged but not processed' };
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
   * Handle payment link paid event
   */
  private async handlePaymentLinkPaid(payload: any): Promise<{ success: boolean; message: string }> {
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
      throw new NotFoundException(`Payment not found for payment link ${paymentLinkId}`);
    }

    // Update payment record
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'success',
        processedAt: new Date(),
        gatewayResponse: {
          ...payment.gatewayResponse as any,
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
   * Handle payment link expired event
   */
  private async handlePaymentLinkExpired(payload: any): Promise<{ success: boolean; message: string }> {
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
   * Handle payment link cancelled event
   */
  private async handlePaymentLinkCancelled(payload: any): Promise<{ success: boolean; message: string }> {
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
   * Handle payment captured event
   */
  private async handlePaymentCaptured(payload: any): Promise<{ success: boolean; message: string }> {
    // Additional processing if needed for captured payments
    return { success: true, message: 'Payment capture processed' };
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(payload: any): Promise<{ success: boolean; message: string }> {
    // Additional processing if needed for failed payments
    return { success: true, message: 'Payment failure processed' };
  }

  /**
   * Get payment details by ID
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