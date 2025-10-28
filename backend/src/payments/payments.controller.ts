import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  UseInterceptors,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { PaymentsService } from './payments.service';
import { FlexiblePaymentService } from './services/flexible-payment.service';
import { RazorpayService } from './services/razorpay.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentLinkResponseDto,
  RazorpayWebhookDto
} from './dto/create-payment-link.dto';
import {
  PaymentOptionsResponseDto,
  SelectPaymentMethodDto,
  RecordCashPaymentDto,
  VenueOnboardingDto,
  CommissionSummaryDto,
  VenuePaymentConfigDto,
} from './dto/payment-options.dto';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { RequireIdempotency, OptionalIdempotency } from '../common/decorators/idempotent.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/dto/auth-response.dto';

/**
 * Enhanced Payments Controller - Flexible payment system for all venue types
 * 
 * Features:
 * 1. Payment options generation (cash, hybrid, online)
 * 2. Cash payment recording and tracking
 * 3. Venue onboarding and configuration
 * 4. Commission management
 * 5. Razorpay integration for online payments
 * 6. Webhook handling for payment status updates
 * 
 * **Authentication**: All endpoints require JWT except webhooks (use @Public)
 */
@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly flexiblePaymentService: FlexiblePaymentService,
    private readonly razorpayService: RazorpayService,
    private readonly prisma: PrismaService,
  ) { }

  // =====================================
  // PAYMENT OPTIONS & SELECTION
  // =====================================

  /**
   * GET /payments/bookings/:id/options - Get payment options for booking
   */
  @Get('bookings/:id/options')
  @OptionalIdempotency()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get payment options for booking',
    description: 'Returns available payment methods based on venue profile (cash-only, hybrid, online, etc.)',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiQuery({ name: 'location', description: 'Customer location for smart recommendations', required: false })
  @ApiResponse({ status: 200, description: 'Payment options generated', type: PaymentOptionsResponseDto })
  async getPaymentOptions(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Query('location') location?: string,
  ): Promise<{ success: boolean; data: PaymentOptionsResponseDto }> {
    const options = await this.flexiblePaymentService.generatePaymentOptions(
      user.tenantId,
      bookingId,
      location,
    );

    return {
      success: true,
      data: options,
    };
  }

  /**
   * POST /payments/bookings/:id/select-method - Select payment method for booking
   */
  @Post('bookings/:id/select-method')
  @RequireIdempotency()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Select payment method for booking',
    description: 'Customer selects their preferred payment method (cash, deposit+cash, full online, etc.)',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Payment method selected successfully' })
  async selectPaymentMethod(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() selection: SelectPaymentMethodDto,
  ): Promise<{ success: boolean; data: any; message: string }> {
    const result = await this.flexiblePaymentService.selectPaymentMethod(
      user.tenantId,
      bookingId,
      selection,
    );

    return {
      success: true,
      data: result,
      message: 'Payment method selected successfully. Follow next steps to complete your booking.',
    };
  }

  // =====================================
  // ONLINE PAYMENT LINKS (RAZORPAY)
  // =====================================

  /**
   * POST /payments/bookings/:id/payment-link - Create payment link for online portion
   */
  @Post('bookings/:id/payment-link')
  @HttpCode(HttpStatus.CREATED)
  @RequireIdempotency()
  @ApiOperation({
    summary: 'Create payment link for booking',
    description: 'Generates Razorpay payment link for online payment portion (deposit or full amount)',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 201, type: PaymentLinkResponseDto })
  async createPaymentLink(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
  ): Promise<{ success: boolean; data: PaymentLinkResponseDto; message: string }> {
    const paymentLink = await this.paymentsService.createPaymentLinkForBooking(
      user.tenantId,
      bookingId,
    );

    return {
      success: true,
      data: paymentLink,
      message: 'Payment link created successfully. Complete payment within the specified time.',
    };
  }

  /**
   * POST /payments/webhook - Handle Razorpay webhooks
   * 
   * **Public Endpoint**: No authentication required (webhook from Razorpay)
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Razorpay webhooks',
    description: 'Processes webhook events from Razorpay for payment status updates',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<void> {
    try {
      const rawBody = JSON.stringify(req.body);

      if (!signature) {
        throw new BadRequestException('Missing webhook signature');
      }

      const isValidSignature = this.razorpayService.verifyWebhookSignature(rawBody, signature);
      if (!isValidSignature) {
        throw new BadRequestException('Invalid webhook signature');
      }

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

  // =====================================
  // CASH PAYMENT MANAGEMENT
  // =====================================

  /**
   * POST /payments/bookings/:id/cash-payment - Record cash payment by venue staff
   */
  @Post('bookings/:id/cash-payment')
  @RequireIdempotency()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record cash payment for booking',
    description: 'Venue staff records when customer pays cash portion of booking',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 201, description: 'Cash payment recorded successfully' })
  async recordCashPayment(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() paymentData: RecordCashPaymentDto,
  ): Promise<{ success: boolean; data: any; message: string }> {
    const result = await this.flexiblePaymentService.recordCashPayment(
      user.tenantId,
      bookingId,
      user.userId,
      paymentData,
    );

    return {
      success: true,
      data: result,
      message: `Cash payment of ₹${(paymentData.amountCents / 100).toLocaleString('en-IN')} recorded successfully.`,
    };
  }

  /**
   * GET /payments/bookings/:id/cash-summary - Get cash payment summary for booking
   */
  @Get('bookings/:id/cash-summary')
  @ApiOperation({
    summary: 'Get cash payment summary',
    description: 'Returns summary of cash payments for a booking',
  })
  async getCashPaymentSummary(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
  ): Promise<{ success: boolean; data: any }> {
    const booking = await this.paymentsService.getPaymentById(user.tenantId, bookingId);

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    // Calculate cash payment summary
    const cashPayments = booking.cashPayments || [];
    const totalCashPaid = cashPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const remainingCash = Math.max(0, booking.cashAmountDue - totalCashPaid);

    return {
      success: true,
      data: {
        bookingId,
        cashAmountDue: booking.cashAmountDue,
        totalCashPaid,
        remainingCash,
        isComplete: remainingCash === 0,
        payments: cashPayments.map(p => ({
          id: p.id,
          amount: p.amountCents,
          method: p.paymentMethod,
          recordedAt: p.recordedAt,
          recordedBy: p.recordedByUser?.name,
          receiptNumber: p.receiptNumber,
          status: p.verificationStatus,
        })),
      },
    };
  }

  // =====================================
  // VENUE CONFIGURATION
  // =====================================

  /**
   * POST /payments/venues/:id/onboarding - Process venue onboarding questionnaire
   */
  @Post('venues/:id/onboarding')
  @RequireIdempotency()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process venue payment onboarding',
    description: 'Analyzes venue responses and recommends optimal payment profile',
  })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiResponse({ status: 200, description: 'Onboarding completed, payment profile recommended' })
  async processVenueOnboarding(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
    @Body() responses: VenueOnboardingDto,
  ): Promise<{ success: boolean; data: any; message: string }> {
    const result = await this.flexiblePaymentService.processVenueOnboarding(
      user.tenantId,
      venueId,
      responses,
    );

    return {
      success: true,
      data: result,
      message: `Payment profile '${result.recommendedProfile}' configured for venue.`,
    };
  }

  /**
   * GET /payments/venues/:id/configuration - Get venue payment configuration
   */
  @Get('venues/:id/configuration')
  @ApiOperation({
    summary: 'Get venue payment configuration',
    description: 'Returns current payment settings for venue',
  })
  async getVenueConfiguration(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
  ): Promise<{ success: boolean; data: VenuePaymentConfigDto }> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, tenantId: user.tenantId },
    });

    if (!venue) {
      throw new BadRequestException('Venue not found');
    }

    const config: VenuePaymentConfigDto = {
      paymentProfile: venue.paymentProfile as any,
      allowCashPayments: venue.allowCashPayments,
      cashDiscountPercentage: venue.cashDiscountPercentage ? parseFloat(venue.cashDiscountPercentage.toString()) : 0,
      requiresOnlineDeposit: venue.requiresOnlineDeposit,
      depositType: venue.depositType as any,
      depositAmount: venue.depositAmount,
      hasRazorpayAccount: venue.hasRazorpayAccount,
      platformHandlesPayments: venue.platformHandlesPayments,
      confirmationTrigger: venue.confirmationTrigger as any,
      platformCommissionPercentage: parseFloat(venue.platformCommissionPercentage.toString()),
      paymentDueDaysBeforeEvent: venue.paymentDueDaysBeforeEvent,
    };

    return {
      success: true,
      data: config,
    };
  }

  // =====================================
  // COMMISSION & ANALYTICS
  // =====================================

  /**
   * GET /payments/venues/:id/commission-summary - Get commission summary for venue
   */
  @Get('venues/:id/commission-summary')
  @ApiOperation({
    summary: 'Get commission summary for venue',
    description: 'Returns commission breakdown and collection status',
  })
  @ApiQuery({ name: 'startDate', description: 'Start date (YYYY-MM-DD)', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date (YYYY-MM-DD)', required: false })
  @ApiResponse({ status: 200, type: CommissionSummaryDto })
  async getCommissionSummary(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{ success: boolean; data: CommissionSummaryDto }> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const end = endDate ? new Date(endDate) : new Date(); // Default: today

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const summary = await this.flexiblePaymentService.getCommissionSummary(
      user.tenantId,
      venueId,
      start,
      end,
    );

    return {
      success: true,
      data: summary,
    };
  }

  // =====================================
  // PAYMENT DETAILS & HISTORY
  // =====================================

  /**
   * GET /payments/:id - Get payment details by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get payment details by ID',
    description: 'Retrieves comprehensive payment information',
  })
  async getPaymentById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) paymentId: string,
  ): Promise<{ success: boolean; data: any }> {
    const payment = await this.paymentsService.getPaymentById(user.tenantId, paymentId);

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
        amount: payment.amountCents,
        currency: payment.currency,
        status: payment.status,
        processedAt: payment.processedAt,
        createdAt: payment.createdAt,
        customer: {
          name: payment.booking.user.name,
          phone: payment.booking.user.phone,
        },
        venue: {
          name: payment.booking.venue.name,
        },
        gatewayResponse: payment.gatewayResponse,
      },
    };
  }

  /**
   * GET /payments/bookings/:id/history - Get complete payment history for booking
   */
  @Get('bookings/:id/history')
  @ApiOperation({
    summary: 'Get payment history for booking',
    description: 'Returns all payments (online and cash) for a booking',
  })
  async getBookingPaymentHistory(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
  ): Promise<{ success: boolean; data: any }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId: user.tenantId },
      include: {
        payments: true,
        cashPayments: {
          include: {
            recordedByUser: {
              select: { name: true },
            },
          },
        },
        commissionRecord: true,
      },
    });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    const onlinePayments = booking.payments.map(p => ({
      type: 'online' as const,
      id: p.id,
      provider: p.provider,
      amount: p.amountCents,
      status: p.status,
      processedAt: p.processedAt,
      createdAt: p.createdAt,
      ts: p.createdAt,
    }));

    const cashPayments = booking.cashPayments.map(p => ({
      type: 'cash' as const,
      id: p.id,
      method: p.paymentMethod,
      amount: p.amountCents,
      status: p.verificationStatus,
      recordedAt: p.recordedAt,
      recordedBy: p.recordedByUser?.name,
      receiptNumber: p.receiptNumber,
      ts: p.recordedAt,
    }));


    const allPayments = [...onlinePayments, ...cashPayments].sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );

    const totalPaid = onlinePayments.reduce((sum, p) => p.status === 'success' ? sum + p.amount : sum, 0) +
      cashPayments.reduce((sum, p) => p.status === 'verified' ? sum + p.amount : sum, 0);

    return {
      success: true,
      data: {
        bookingId,
        totalAmount: booking.totalAmountCents,
        totalPaid,
        remainingAmount: Math.max(0, (booking.totalAmountCents ?? 0) - totalPaid),
        paymentMethod: booking.paymentMethod,
        onlineAmountDue: booking.onlineAmountDue,
        cashAmountDue: booking.cashAmountDue,
        paymentStatus: booking.paymentStatus,
        payments: allPayments,
        commission: booking.commissionRecord.map(c => ({
          amount: c.commissionAmountCents,
          percentage: parseFloat(c.commissionPercentage.toString()),
          status: c.commissionStatus,
          collectionMethod: c.collectionMethod,
          dueDate: c.dueDate,
        })),
      },
    };
  }
}
