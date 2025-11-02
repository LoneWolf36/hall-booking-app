// CRIT-002: Backend Razorpay Webhook Controller
// Complete implementation with signature verification and booking status updates

import { 
  Controller, 
  Post, 
  Body, 
  Req, 
  Res, 
  Headers, 
  Logger,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import * as crypto from 'crypto';

interface RazorpayWebhookEvent {
  account_id: string;
  contains: string[];
  created_at: number;
  entity: string;
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        order_id: string;
        invoice_id?: string;
        international: boolean;
        method: string;
        amount_refunded: number;
        refund_status?: string;
        captured: boolean;
        description?: string;
        card_id?: string;
        bank?: string;
        wallet?: string;
        vpa?: string;
        email: string;
        contact: string;
        notes: Record<string, any>;
        fee?: number;
        tax?: number;
        error_code?: string;
        error_description?: string;
        error_source?: string;
        error_step?: string;
        error_reason?: string;
        acquirer_data?: Record<string, any>;
        created_at: number;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        amount_paid: number;
        amount_due: number;
        currency: string;
        receipt?: string;
        offer_id?: string;
        status: string;
        attempts: number;
        notes: Record<string, any>;
        created_at: number;
      };
    };
  };
}

@Controller('api/v1/payments')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Razorpay webhook endpoint - handles payment events
   * This endpoint is public (no JWT required) but uses signature verification
   */
  @Public()
  @Post('webhook')
  async handleRazorpayWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature: string,
    @Body() body: RazorpayWebhookEvent,
  ) {
    try {
      // Step 1: Signature verification
      if (!this.verifyWebhookSignature(req, signature)) {
        this.logger.warn('Webhook signature verification failed', {
          signature: signature?.substring(0, 10) + '...',
          event: body.event,
        });
        return res.status(HttpStatus.BAD_REQUEST).send('Invalid signature');
      }

      // Step 2: Log webhook event
      this.logger.log('Webhook received', {
        event: body.event,
        account_id: body.account_id,
        created_at: new Date(body.created_at * 1000).toISOString(),
      });

      // Step 3: Process event based on type
      switch (body.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(body);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(body);
          break;
        case 'order.paid':
          await this.handleOrderPaid(body);
          break;
        default:
          this.logger.log(`Unhandled webhook event: ${body.event}`);
      }

      // Step 4: Return success
      return res.status(HttpStatus.OK).json({ 
        status: 'success', 
        processed: true,
        event: body.event,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Webhook processing failed', {
        error: error.message,
        event: body.event,
        stack: error.stack,
      });

      // Still return 200 to prevent Razorpay retries for our internal errors
      return res.status(HttpStatus.OK).json({
        status: 'error',
        message: 'Internal processing error',
        processed: false,
      });
    }
  }

  /**
   * Create Razorpay order (called by frontend before checkout)
   */
  @Post('create-order')
  async createOrder(
    @Body() createOrderDto: {
      bookingId: string;
      amount: number;
      currency?: string;
      receipt?: string;
    },
  ) {
    try {
      const order = await this.paymentsService.createRazorpayOrder({
        bookingId: createOrderDto.bookingId,
        amount: createOrderDto.amount,
        currency: createOrderDto.currency || 'INR',
        receipt: createOrderDto.receipt || `booking_${createOrderDto.bookingId}`,
      });

      return order;
    } catch (error) {
      this.logger.error('Order creation failed', {
        bookingId: createOrderDto.bookingId,
        amount: createOrderDto.amount,
        error: error.message,
      });
      throw new BadRequestException('Failed to create payment order');
    }
  }

  /**
   * Verify payment (optional - mainly for client-side verification)
   */
  @Post('verify')
  async verifyPayment(
    @Body() verifyDto: {
      bookingId: string;
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    },
  ) {
    try {
      const result = await this.paymentsService.verifyPaymentSignature(verifyDto);
      return { verified: true, booking: result };
    } catch (error) {
      this.logger.error('Payment verification failed', {
        bookingId: verifyDto.bookingId,
        payment_id: verifyDto.razorpay_payment_id,
        error: error.message,
      });
      throw new BadRequestException('Payment verification failed');
    }
  }

  // Private helper methods

  private verifyWebhookSignature(req: Request, signature: string): boolean {
    if (!signature) return false;

    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        this.logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
        return false;
      }

      // Get raw body (ensure your NestJS app preserves raw body for webhooks)
      const body = (req as any).rawBody || JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body, 'utf8')
        .digest('hex');

      // Razorpay sends signature as hex string
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      this.logger.error('Signature verification error', { error: error.message });
      return false;
    }
  }

  private async handlePaymentCaptured(event: RazorpayWebhookEvent) {
    const payment = event.payload.payment?.entity;
    if (!payment) return;

    this.logger.log('Processing payment.captured', {
      payment_id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      status: payment.status,
    });

    // Update booking status based on successful payment
    await this.paymentsService.handleSuccessfulPayment({
      paymentId: payment.id,
      orderId: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      razorpayData: payment,
    });
  }

  private async handlePaymentFailed(event: RazorpayWebhookEvent) {
    const payment = event.payload.payment?.entity;
    if (!payment) return;

    this.logger.log('Processing payment.failed', {
      payment_id: payment.id,
      order_id: payment.order_id,
      error_code: payment.error_code,
      error_description: payment.error_description,
    });

    // Handle failed payment - maybe notify customer or admin
    await this.paymentsService.handleFailedPayment({
      paymentId: payment.id,
      orderId: payment.order_id,
      errorCode: payment.error_code,
      errorDescription: payment.error_description,
      razorpayData: payment,
    });
  }

  private async handleOrderPaid(event: RazorpayWebhookEvent) {
    const order = event.payload.order?.entity;
    if (!order) return;

    this.logger.log('Processing order.paid', {
      order_id: order.id,
      amount_paid: order.amount_paid,
      status: order.status,
    });

    // Additional confirmation that order is fully paid
    if (order.amount_paid >= order.amount) {
      await this.paymentsService.confirmOrderPayment({
        orderId: order.id,
        amountPaid: order.amount_paid,
        razorpayData: order,
      });
    }
  }
}

/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * 
 * Backend (.env):
 * - RAZORPAY_KEY_ID=rzp_test_xxxxxxx (test mode)
 * - RAZORPAY_KEY_SECRET=your_secret_key
 * - RAZORPAY_WEBHOOK_SECRET=webhook_secret_from_dashboard
 * 
 * Frontend (.env.local):
 * - NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxx
 * - NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 (or staging URL)
 * 
 * WEBHOOK SETUP IN RAZORPAY DASHBOARD:
 * 1. Go to Settings > Webhooks
 * 2. Add endpoint: https://yourdomain.com/api/v1/payments/webhook
 * 3. Select events: payment.captured, payment.failed, order.paid
 * 4. Copy webhook secret to environment variables
 * 
 * TESTING COMMANDS:
 * 
 * # Test webhook locally (use ngrok or similar)
 * curl -X POST http://localhost:3000/api/v1/payments/webhook \
 *   -H "Content-Type: application/json" \
 *   -H "X-Razorpay-Signature: your_test_signature" \
 *   -d '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test123"}}}}'
 * 
 * # Test order creation
 * curl -X POST http://localhost:3000/api/v1/payments/create-order \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer your_jwt_token" \
 *   -d '{"bookingId":"booking-123","amount":50000,"currency":"INR"}'
 */