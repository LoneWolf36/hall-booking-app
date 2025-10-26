import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { CreatePaymentLinkDto, PaymentLinkResponseDto } from '../dto/create-payment-link.dto';

/**
 * Razorpay Service - Handles all Razorpay API interactions
 * 
 * Features:
 * 1. Payment link creation with booking integration
 * 2. Webhook signature verification
 * 3. Payment status tracking
 * 4. Error handling and logging
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly razorpay: Razorpay;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET')!;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    }

    if (!this.webhookSecret) {
      throw new Error('Razorpay webhook secret not configured. Check RAZORPAY_WEBHOOK_SECRET');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    this.logger.log('Razorpay client initialized successfully');
  }

  /**
   * Create payment link for booking
   * 
   * @param createPaymentLinkDto Payment link creation data
   * @returns Payment link response with URL and metadata
   */
  async createPaymentLink(createPaymentLinkDto: CreatePaymentLinkDto): Promise<PaymentLinkResponseDto> {
    try {
      const {
        bookingId,
        amountCents,
        currency,
        description,
        customerName,
        customerPhone,
        customerEmail,
        expiresAt,
        callbackUrl,
        cancelUrl,
        metadata,
      } = createPaymentLinkDto;

      // Calculate expiry time (default to 15 minutes if not provided)
      const expireBy = expiresAt 
        ? Math.floor(new Date(expiresAt).getTime() / 1000)
        : Math.floor((Date.now() + 15 * 60 * 1000) / 1000);

      // Prepare payment link payload
      const paymentLinkPayload = {
        amount: amountCents, // Razorpay expects amount in paise for INR
        currency,
        accept_partial: false,
        description: description || `Payment for Hall Booking`,
        customer: {
          name: customerName,
          contact: customerPhone,
          email: customerEmail,
        },
        notify: {
          sms: true,
          email: customerEmail ? true : false,
        },
        reminder_enable: true,
        notes: {
          booking_id: bookingId,
          purpose: 'hall_booking_payment',
          ...metadata,
        },
        callback_url: callbackUrl,
        callback_method: 'get',
        expire_by: expireBy,
      };

      // Add cancel URL if provided
      if (cancelUrl) {
        (paymentLinkPayload as any).cancel_url = cancelUrl;
      }

      this.logger.log(`Creating payment link for booking ${bookingId}`, {
        amount: amountCents,
        currency,
        expireBy: new Date(expireBy * 1000).toISOString(),
      });

      // Create payment link via Razorpay API
      const response = await this.razorpay.paymentLink.create(paymentLinkPayload);

      const expiresInMinutes = Math.floor((expireBy * 1000 - Date.now()) / (1000 * 60));

      this.logger.log(`Payment link created successfully: ${response.id}`, {
        shortUrl: response.short_url,
        expiresInMinutes,
      });

      return {
        id: String(response.id),
        shortUrl: String(response.short_url),
        amount: Number(response.amount),
        currency: response.currency ?? 'INR',
        status: String(response.status),
        expireBy: response.expire_by ? new Date(Number(response.expire_by) * 1000) : new Date(expireBy * 1000),
        paymentId: '', // Will be set when payment record is created
        bookingId,
        expiresInMinutes,
      };
    } catch (error) {
      this.logger.error('Failed to create payment link', {
        error: error.message,
        bookingId: createPaymentLinkDto.bookingId,
        stack: error.stack,
      });

      if (error.statusCode) {
        throw new BadRequestException({
          message: 'Failed to create payment link',
          details: error.error?.description || error.message,
          code: 'RAZORPAY_ERROR',
        });
      }

      throw new InternalServerErrorException({
        message: 'Payment service unavailable',
        code: 'PAYMENT_SERVICE_ERROR',
      });
    }
  }

  /**
   * Verify webhook signature for security
   * 
   * @param payload Raw webhook payload
   * @param signature Razorpay signature header
   * @returns True if signature is valid
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (isValid) {
        this.logger.log('Webhook signature verified successfully');
      } else {
        this.logger.warn('Invalid webhook signature received', {
          receivedSignature: signature.substring(0, 20) + '...',
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   * 
   * @param paymentId Razorpay payment ID
   * @returns Payment details
   */
  async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      this.logger.log(`Retrieved payment details for ${paymentId}`, {
        status: payment.status,
        amount: payment.amount,
      });
      return payment;
    } catch (error) {
      this.logger.error(`Failed to fetch payment details for ${paymentId}`, {
        error: error.message,
      });
      throw new BadRequestException({
        message: 'Failed to fetch payment details',
        code: 'PAYMENT_FETCH_ERROR',
      });
    }
  }

  /**
   * Fetch payment link details from Razorpay
   * 
   * @param paymentLinkId Razorpay payment link ID
   * @returns Payment link details
   */
  async getPaymentLinkDetails(paymentLinkId: string): Promise<any> {
    try {
      const paymentLink = await this.razorpay.paymentLink.fetch(paymentLinkId);
      this.logger.log(`Retrieved payment link details for ${paymentLinkId}`, {
        status: paymentLink.status,
        amount: paymentLink.amount,
      });
      return paymentLink;
    } catch (error) {
      this.logger.error(`Failed to fetch payment link details for ${paymentLinkId}`, {
        error: error.message,
      });
      throw new BadRequestException({
        message: 'Failed to fetch payment link details',
        code: 'PAYMENT_LINK_FETCH_ERROR',
      });
    }
  }

  /**
   * Cancel payment link
   * 
   * @param paymentLinkId Razorpay payment link ID
   * @returns Cancellation result
   */
  async cancelPaymentLink(paymentLinkId: string): Promise<any> {
    try {
      const result = await this.razorpay.paymentLink.cancel(paymentLinkId);
      this.logger.log(`Payment link cancelled: ${paymentLinkId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to cancel payment link ${paymentLinkId}`, {
        error: error.message,
      });
      throw new BadRequestException({
        message: 'Failed to cancel payment link',
        code: 'PAYMENT_LINK_CANCEL_ERROR',
      });
    }
  }
}