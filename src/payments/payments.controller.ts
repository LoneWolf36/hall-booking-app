import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  UseInterceptors,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './services/razorpay.service';
import { PaymentLinkResponseDto, RazorpayWebhookDto } from './dto/create-payment-link.dto';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { RequireIdempotency } from '../common/decorators/idempotent.decorator';

/**
 * Payments Controller - REST API endpoints for payment operations
 * 
 * Features:
 * 1. Create payment links for bookings
 * 2. Handle Razorpay webhooks
 * 3. Payment status tracking
 * 4. Secure webhook signature verification
 */
@ApiTags('Payments')
@Controller('payments')
@UseInterceptors(LoggingInterceptor)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * POST /bookings/:id/payment-link - Create payment link for booking
   */
  @Post('/bookings/:id/payment-link')
  @HttpCode(HttpStatus.CREATED)
  @RequireIdempotency()
  @ApiOperation({
    summary: 'Create payment link for booking',
    description: 'Generates a Razorpay payment link for the specified booking with automatic expiry matching the booking hold time.',
  })
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Tenant identifier for multi-tenant isolation',
    required: true,
  })
  @ApiParam({
    name: 'id',
    description: 'Booking UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Payment link created successfully', 
    type: PaymentLinkResponseDto 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Booking not found or not eligible for payment' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Payment already initiated for this booking' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Booking hold has expired or invalid request' 
  })
  async createPaymentLink(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) bookingId: string,
  ): Promise<{ success: boolean; data: PaymentLinkResponseDto; message: string }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    const paymentLink = await this.paymentsService.createPaymentLinkForBooking(
      tenantId,
      bookingId,
    );

    return {
      success: true,
      data: paymentLink,
      message: 'Payment link created successfully. Complete payment within the specified time to confirm your booking.',
    };
  }

  /**
   * POST /payments/webhook - Handle Razorpay webhooks
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Razorpay webhooks',
    description: 'Processes webhook events from Razorpay for payment status updates with signature verification.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid webhook signature' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid webhook payload' 
  })
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<void> {
    try {
      // Get raw body for signature verification
      const rawBody = JSON.stringify(req.body);

      // Verify webhook signature
      if (!signature) {
        throw new BadRequestException('Missing webhook signature');
      }

      const isValidSignature = this.razorpayService.verifyWebhookSignature(rawBody, signature);
      if (!isValidSignature) {
        throw new BadRequestException('Invalid webhook signature');
      }

      // Process webhook
      const webhookPayload: RazorpayWebhookDto = req.body;
      const result = await this.paymentsService.handleWebhook(webhookPayload);

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Webhook processing failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /payments/:id - Get payment details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get payment details by ID',
    description: 'Retrieves payment information including status, gateway response, and associated booking details.',
  })
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Tenant identifier',
    required: true,
  })
  @ApiParam({
    name: 'id',
    description: 'Payment UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Payment details retrieved successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Payment not found' 
  })
  async getPaymentById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) paymentId: string,
  ): Promise<{ success: boolean; data: any }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    const payment = await this.paymentsService.getPaymentById(tenantId, paymentId);
    
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    return {
      success: true,
      data: {
        id: payment.id,
        bookingId: payment.bookingId,
        bookingNumber: payment.booking.bookingNumber,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        amount: payment.amountCents,
        currency: payment.currency,
        status: payment.status,
        processedAt: payment.processedAt,
        createdAt: payment.createdAt,
        customer: {
          name: payment.booking.user.name,
          phone: payment.booking.user.phone,
          email: payment.booking.user.email,
        },
        venue: {
          name: payment.booking.venue.name,
        },
        gatewayResponse: payment.gatewayResponse,
      },
    };
  }

  /**
   * GET /payments/booking/:bookingId - Get payments for a booking
   */
  @Get('booking/:bookingId')
  @ApiOperation({
    summary: 'Get payments for a booking',
    description: 'Retrieves all payment attempts for a specific booking.',
  })
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Tenant identifier',
    required: true,
  })
  @ApiParam({
    name: 'bookingId',
    description: 'Booking UUID',
    type: 'string',
    format: 'uuid',
  })
  async getPaymentsForBooking(
    @Headers('x-tenant-id') tenantId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<{ success: boolean; data: any[] }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    const payments = await this.paymentsService.getPaymentById(tenantId, bookingId);
    
    return {
      success: true,
      data: payments || [],
    };
  }

  /**
   * POST /payments/:id/refresh - Refresh payment status from Razorpay
   */
  @Post(':id/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh payment status',
    description: 'Fetches latest payment status from Razorpay and updates local records.',
  })
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Tenant identifier',
    required: true,
  })
  async refreshPaymentStatus(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) paymentId: string,
  ): Promise<{ success: boolean; data: any; message: string }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    const payment = await this.paymentsService.getPaymentById(tenantId, paymentId);
    
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (!payment.providerPaymentId) {
      throw new BadRequestException('No provider payment ID found');
    }

    // Fetch latest status from Razorpay
    const razorpayPayment = await this.razorpayService.getPaymentLinkDetails(
      payment.providerPaymentId
    );

    return {
      success: true,
      data: {
        localStatus: payment.status,
        razorpayStatus: razorpayPayment.status,
        lastUpdated: payment.updatedAt,
      },
      message: 'Payment status refreshed from Razorpay',
    };
  }
}