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
import type { Request, Response } from 'express';
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
    payment_link?: {
      entity: {
        id: string;
        status: string;
        amount: number;
        currency: string;
        description?: string;
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

      // Step 3: Process event using existing PaymentsService webhook handler
      const result = await this.paymentsService.handleWebhook({
        event: body.event,
        payload: body.payload,
      });

      // Step 4: Return success
      return res.status(HttpStatus.OK).json({ 
        status: 'success', 
        processed: true,
        event: body.event,
        timestamp: new Date().toISOString(),
        message: result.message,
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
   * Create payment link (delegates to PaymentsService)
   */
  @Post('create-link')
  async createPaymentLink(
    @Body() createLinkDto: {
      bookingId: string;
      tenantId: string;
    },
  ) {
    try {
      const paymentLink = await this.paymentsService.createPaymentLinkForBooking(
        createLinkDto.tenantId,
        createLinkDto.bookingId,
      );

      return paymentLink;
    } catch (error) {
      this.logger.error('Payment link creation failed', {
        bookingId: createLinkDto.bookingId,
        tenantId: createLinkDto.tenantId,
        error: error.message,
      });
      throw error; // Let NestJS handle the exception response
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
 * 3. Select events: payment_link.paid, payment_link.expired, payment.captured, payment.failed
 * 4. Copy webhook secret to environment variables
 * 
 * TESTING COMMANDS:
 * 
 * # Test webhook locally (use ngrok or similar)
 * curl -X POST http://localhost:3000/api/v1/payments/webhook \
 *   -H "Content-Type: application/json" \
 *   -H "X-Razorpay-Signature: your_test_signature" \
 *   -d '{"event":"payment_link.paid","payload":{"payment_link":{"entity":{"id":"plink_test123"}}}}'
 * 
 * # Test payment link creation
 * curl -X POST http://localhost:3000/api/v1/payments/create-link \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer your_jwt_token" \
 *   -d '{"bookingId":"booking-123","tenantId":"tenant-123"}'
 */