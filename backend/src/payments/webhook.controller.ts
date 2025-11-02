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
      entity: any;
    };
    order?: {
      entity: any;
    };
    payment_link?: {
      entity: any;
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
        created_at: new Date(body.created_at * 1000).toISOString?.() || new Date().toISOString(),
      });

      // Step 3: Adapt payload to RazorpayWebhookDto shape expected by service
      const adaptedPayload: { payment_link: { entity: any }; payment?: { entity: any } } = {
        payment_link: {
          entity: body.payload.payment_link?.entity ?? {},
        },
        ...(body.payload.payment ? { payment: { entity: body.payload.payment.entity } } : {}),
      };

      const result = await this.paymentsService.handleWebhook({
        event: body.event,
        payload: adaptedPayload,
        created_at: body.created_at ?? Math.floor(Date.now() / 1000),
      } as any);

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
        event: (body as any)?.event,
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
