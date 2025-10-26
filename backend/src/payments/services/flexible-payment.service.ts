import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import {
  VenuePaymentProfile,
  PaymentMethod,
  ConfirmationTrigger,
  PaymentOptionDto,
  PaymentOptionsResponseDto,
  SelectPaymentMethodDto,
  RecordCashPaymentDto,
  VenueOnboardingDto,
  CommissionSummaryDto,
} from '../dto/payment-options.dto';
import { RazorpayService } from './razorpay.service';

// Define next step interface for type safety
interface NextStep {
  action: string;
  description: string;
  deadline?: Date;
}

/**
 * Flexible Payment Service - Core orchestrator for all payment methods
 * 
 * Responsibilities:
 * 1. Generate payment options based on venue profile
 * 2. Handle cash-only, hybrid, and online payment flows
 * 3. Manage venue onboarding and configuration
 * 4. Track commissions across all payment methods
 */
@Injectable()
export class FlexiblePaymentService {
  private readonly logger = new Logger(FlexiblePaymentService.name);
  private readonly OPTIONS_CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * Generate payment options for a booking based on venue profile
   */
  async generatePaymentOptions(
    tenantId: string,
    bookingId: string,
    customerLocation?: string,
  ): Promise<PaymentOptionsResponseDto> {
    const cacheKey = `payment-options:${bookingId}`;
    const cached = await this.cacheService.get<PaymentOptionsResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached payment options for booking ${bookingId}`);
      return cached;
    }

    try {
      // Get booking with venue and customer details
      const booking = await this.prisma.booking.findFirst({
        where: {
          id: bookingId,
          tenantId,
        },
        include: {
          venue: true,
          user: true,
        },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${bookingId} not found`);
      }

      // Get customer preferences
      const customerPreferences = await this.getCustomerPreferences(
        tenantId,
        booking.userId,
        customerLocation,
      );

      // Generate options based on venue profile
      const options = await this.generateOptionsForVenue(
        booking,
        customerPreferences,
      );

      const response: PaymentOptionsResponseDto = {
        bookingId,
        totalAmount: booking.totalAmountCents || 0,
        options: this.sortOptionsByPreference(options, customerPreferences),
        venueProfile: booking.venue.paymentProfile as VenuePaymentProfile,
        customerPreferences,
      };

      // Cache for 10 minutes
      await this.cacheService.set(cacheKey, response, this.OPTIONS_CACHE_TTL);

      this.logger.log(`Generated ${options.length} payment options for booking ${bookingId}`);
      return response;
    } catch (error) {
      this.logger.error('Failed to generate payment options', {
        error: error.message,
        bookingId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Process customer's payment method selection
   */
  async selectPaymentMethod(
    tenantId: string,
    bookingId: string,
    selection: SelectPaymentMethodDto,
  ): Promise<{ success: boolean; booking: any; nextSteps: NextStep[] }> {
    try {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { venue: true, user: true },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${bookingId} not found`);
      }

      if (booking.status !== 'temp_hold') {
        throw new ConflictException(
          `Cannot select payment method for booking in ${booking.status} status`
        );
      }

      // Calculate payment amounts based on selection
      const paymentAmounts = this.calculatePaymentAmounts(
        booking.totalAmountCents || 0,
        selection.selectedMethod,
        booking.venue,
      );

      // Update booking with payment method selection
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentMethod: selection.selectedMethod,
          onlineAmountDue: paymentAmounts.onlineAmount,
          cashAmountDue: paymentAmounts.cashAmount,
          cashDiscountApplied: paymentAmounts.cashDiscount,
          cashPaymentAcknowledged: selection.cashTermsAcknowledged || false,
          requiresManualConfirmation: this.requiresManualConfirmation(
            selection.selectedMethod,
            booking.venue,
          ),
          status: this.determineNewStatus(selection.selectedMethod, booking.venue),
        },
        include: { venue: true, user: true },
      });

      // Update customer preferences
      await this.updateCustomerPreferences(
        tenantId,
        booking.userId,
        selection,
      );

      // Generate next steps
      const nextSteps = await this.generateNextSteps(
        updatedBooking,
        selection.selectedMethod,
      );

      // Clear cached options
      await this.cacheService.del(`payment-options:${bookingId}`);

      this.logger.log(`Payment method selected for booking ${bookingId}`, {
        method: selection.selectedMethod,
        onlineAmount: paymentAmounts.onlineAmount,
        cashAmount: paymentAmounts.cashAmount,
      });

      return {
        success: true,
        booking: updatedBooking,
        nextSteps,
      };
    } catch (error) {
      this.logger.error('Failed to select payment method', {
        error: error.message,
        bookingId,
        selection,
      });
      throw error;
    }
  }

  /**
   * Record cash payment by venue staff
   */
  async recordCashPayment(
    tenantId: string,
    bookingId: string,
    recordedBy: string,
    paymentData: RecordCashPaymentDto,
  ): Promise<{ success: boolean; payment: any; booking: any }> {
    try {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { venue: true, user: true, cashPayments: true },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${bookingId} not found`);
      }

      if (booking.cashAmountDue <= 0) {
        throw new BadRequestException('No cash payment due for this booking');
      }

      // Calculate total cash already paid
      const totalCashPaid = booking.cashPayments.reduce(
        (sum, payment) => sum + payment.amountCents,
        0,
      );

      if (totalCashPaid + paymentData.amountCents > booking.cashAmountDue) {
        throw new BadRequestException(
          `Payment amount exceeds remaining balance. Due: ₹${(booking.cashAmountDue - totalCashPaid) / 100}, Attempting: ₹${paymentData.amountCents / 100}`
        );
      }

      // Create cash payment record
      const cashPayment = await this.prisma.cashPayment.create({
        data: {
          tenantId,
          bookingId,
          amountCents: paymentData.amountCents,
          recordedBy,
          recordedAt: paymentData.recordedAt
            ? new Date(paymentData.recordedAt)
            : new Date(),
          paymentMethod: paymentData.paymentMethod,
          notes: paymentData.notes,
          receiptNumber: paymentData.receiptNumber,
          verificationStatus: 'verified', // Auto-verify venue staff entries
        },
      });

      // Check if payment is complete
      const newTotalCashPaid = totalCashPaid + paymentData.amountCents;
      const isPaymentComplete = newTotalCashPaid >= booking.cashAmountDue;

      // Update booking status if payment is complete
      let updatedBooking = booking;
      if (isPaymentComplete) {
        updatedBooking = await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: booking.onlineAmountDue > 0 ? 'partial' : 'paid',
            status: 'confirmed',
            confirmedAt: new Date(),
            confirmedBy: recordedBy,
          },
          include: { venue: true, user: true, cashPayments: true },
        });

        // Create commission record
        await this.createCommissionRecord(updatedBooking);
      }

      this.logger.log(`Cash payment recorded for booking ${bookingId}`, {
        amount: paymentData.amountCents,
        paymentComplete: isPaymentComplete,
        recordedBy,
      });

      return {
        success: true,
        payment: cashPayment,
        booking: updatedBooking,
      };
    } catch (error) {
      this.logger.error('Failed to record cash payment', {
        error: error.message,
        bookingId,
        paymentData,
      });
      throw error;
    }
  }

  /**
   * Handle venue onboarding and recommend payment profile
   */
  async processVenueOnboarding(
    tenantId: string,
    venueId: string,
    responses: VenueOnboardingDto,
  ): Promise<{
    recommendedProfile: VenuePaymentProfile;
    configuration: any;
    reasoning: string[];
  }> {
    try {
      // Save onboarding responses
      await this.prisma.venueOnboardingResponse.create({
        data: {
          tenantId,
          venueId,
          paymentPreference: responses.paymentPreference,
          techComfortLevel: responses.techComfortLevel,
          currentPaymentMethods: responses.currentPaymentMethods,
          monthlyBookingVolume: responses.monthlyBookingVolume,
          averageBookingValueCents: responses.averageBookingValueCents,
          responses: responses.additionalResponses,
        },
      });

      // Generate recommendation based on responses
      const recommendation = this.generatePaymentProfileRecommendation(responses);

      // Update venue with recommended configuration
      await this.prisma.venue.update({
        where: { id: venueId },
        data: {
          paymentProfile: recommendation.profile,
          allowCashPayments: recommendation.config.allowCashPayments,
          cashDiscountPercentage: recommendation.config.cashDiscountPercentage,
          requiresOnlineDeposit: recommendation.config.requiresOnlineDeposit,
          depositType: recommendation.config.depositType,
          depositAmount: recommendation.config.depositAmount,
          confirmationTrigger: recommendation.config.confirmationTrigger,
          platformCommissionPercentage: recommendation.config.platformCommissionPercentage,
        },
      });

      this.logger.log(`Venue onboarding completed for ${venueId}`, {
        recommendedProfile: recommendation.profile,
        paymentPreference: responses.paymentPreference,
        techLevel: responses.techComfortLevel,
      });

      return {
        recommendedProfile: recommendation.profile,
        configuration: recommendation.config,
        reasoning: recommendation.reasoning,
      };
    } catch (error) {
      this.logger.error('Failed to process venue onboarding', {
        error: error.message,
        venueId,
      });
      throw error;
    }
  }

  /**
   * Get commission summary for venue
   */
  async getCommissionSummary(
    tenantId: string,
    venueId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CommissionSummaryDto> {
    try {
      const commissionRecords = await this.prisma.commissionRecord.findMany({
        where: {
          tenantId,
          venueId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          booking: true,
        },
      });

      const summary = commissionRecords.reduce(
        (acc, record) => {
          acc.totalBookings += 1;
          acc.totalBookingAmountCents += record.bookingAmountCents;
          acc.totalCommissionCents += record.commissionAmountCents;

          if (record.commissionStatus === 'collected') {
            acc.collectedCommissionCents += record.commissionAmountCents;
          }

          if (record.collectionMethod) {
            acc.collectionMethodBreakdown[record.collectionMethod] =
              (acc.collectionMethodBreakdown[record.collectionMethod] || 0) +
              record.commissionAmountCents;
          }

          return acc;
        },
        {
          totalBookings: 0,
          totalBookingAmountCents: 0,
          totalCommissionCents: 0,
          collectedCommissionCents: 0,
          collectionMethodBreakdown: {} as Record<string, number>,
        },
      );

      return {
        venueId,
        ...summary,
        outstandingCommissionCents:
          summary.totalCommissionCents - summary.collectedCommissionCents,
      };
    } catch (error) {
      this.logger.error('Failed to get commission summary', {
        error: error.message,
        venueId,
      });
      throw error;
    }
  }

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  private async getCustomerPreferences(
    tenantId: string,
    userId: string,
    customerLocation?: string,
  ) {
    const preferences = await this.prisma.customerPaymentPreference.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    return {
      preferredMethod: preferences?.preferredMethod || 'cash',
      cityTier: preferences?.cityTier || this.inferCityTier(customerLocation),
      totalBookings: preferences?.totalBookings || 0,
    };
  }

  private async generateOptionsForVenue(
    booking: any,
    customerPreferences: any,
  ): Promise<PaymentOptionDto[]> {
    const venue = booking.venue;
    const totalAmount = booking.totalAmountCents || 0;
    const options: PaymentOptionDto[] = [];

    switch (venue.paymentProfile) {
      case VenuePaymentProfile.CASH_ONLY:
        options.push(this.createCashOnlyOption(totalAmount, venue));
        break;

      case VenuePaymentProfile.CASH_WITH_DEPOSIT:
        options.push(this.createDepositOption(totalAmount, venue));
        break;

      case VenuePaymentProfile.HYBRID_FLEXIBLE:
        options.push(...this.createHybridOptions(totalAmount, venue));
        break;

      case VenuePaymentProfile.FULL_ONLINE:
        options.push(this.createFullOnlineOption(totalAmount, venue));
        break;

      case VenuePaymentProfile.MARKETPLACE:
        options.push(this.createMarketplaceOption(totalAmount, venue));
        break;
    }

    return options;
  }

  private createCashOnlyOption(
    totalAmount: number,
    venue: any,
  ): PaymentOptionDto {
    const cashDiscount = Math.floor(
      totalAmount * ((venue.cashDiscountPercentage || 0) / 100)
    );
    const finalAmount = totalAmount - cashDiscount;

    return {
      method: PaymentMethod.CASH_FULL,
      onlineAmount: 0,
      cashAmount: finalAmount,
      discount: cashDiscount,
      label: `Pay ₹${this.formatCurrency(finalAmount)} in cash${cashDiscount > 0 ? ` (₹${this.formatCurrency(cashDiscount)} discount)` : ''}`,
      description: 'Full payment in cash when you visit the venue',
      confirmationMethod: ConfirmationTrigger.MANUAL_APPROVAL,
      isRecommended: true,
      benefits: [
        'No online transaction fees',
        'Venue will confirm manually',
        ...(cashDiscount > 0 ? [`₹${this.formatCurrency(cashDiscount)} cash discount`] : []),
      ],
    };
  }

  private createDepositOption(totalAmount: number, venue: any): PaymentOptionDto {
    const depositAmount = this.calculateDeposit(
      totalAmount,
      venue.depositType,
      venue.depositAmount,
    );
    const cashBalance = totalAmount - depositAmount;

    return {
      method: PaymentMethod.DEPOSIT_ONLINE,
      onlineAmount: depositAmount,
      cashAmount: cashBalance,
      discount: 0,
      label: `Pay ₹${this.formatCurrency(depositAmount)} online + ₹${this.formatCurrency(cashBalance)} cash`,
      description: 'Secure your booking with online deposit, pay balance in cash',
      confirmationMethod: ConfirmationTrigger.DEPOSIT_ONLY,
      isRecommended: true,
      benefits: [
        'Instant booking confirmation',
        'Lower upfront cost',
        'Pay balance in cash at venue',
      ],
    };
  }

  private createHybridOptions(totalAmount: number, venue: any): PaymentOptionDto[] {
    const options: PaymentOptionDto[] = [];

    // Option 1: Cash with discount
    const cashDiscount = Math.floor(
      totalAmount * ((venue.cashDiscountPercentage || 0) / 100)
    );
    if (cashDiscount > 0) {
      options.push({
        method: PaymentMethod.CASH_FULL,
        onlineAmount: 0,
        cashAmount: totalAmount - cashDiscount,
        discount: cashDiscount,
        label: `Pay ₹${this.formatCurrency(totalAmount - cashDiscount)} in cash (₹${this.formatCurrency(cashDiscount)} discount)`,
        description: 'Save money with cash payment',
        confirmationMethod: ConfirmationTrigger.MANUAL_APPROVAL,
        benefits: [`₹${this.formatCurrency(cashDiscount)} cash discount`, 'No transaction fees'],
      });
    }

    // Option 2: Deposit + Cash
    const depositAmount = this.calculateDeposit(
      totalAmount,
      venue.depositType,
      venue.depositAmount,
    );
    options.push({
      method: PaymentMethod.DEPOSIT_ONLINE,
      onlineAmount: depositAmount,
      cashAmount: totalAmount - depositAmount,
      discount: 0,
      label: `Pay ₹${this.formatCurrency(depositAmount)} online + ₹${this.formatCurrency(totalAmount - depositAmount)} cash`,
      description: 'Best of both worlds - instant confirmation with cash savings',
      confirmationMethod: ConfirmationTrigger.DEPOSIT_ONLY,
      isRecommended: true,
      benefits: ['Instant confirmation', 'Lower upfront cost', 'Cash balance at venue'],
    });

    // Option 3: Full Online (if venue supports it)
    if (venue.hasRazorpayAccount || venue.platformHandlesPayments) {
      options.push({
        method: PaymentMethod.FULL_ONLINE,
        onlineAmount: totalAmount,
        cashAmount: 0,
        discount: 0,
        label: `Pay full ₹${this.formatCurrency(totalAmount)} online`,
        description: 'Complete payment now, nothing to pay at venue',
        confirmationMethod: ConfirmationTrigger.FULL_PAYMENT,
        benefits: ['Instant confirmation', 'No cash needed at venue', 'Digital receipt'],
      });
    }

    return options;
  }

  private createFullOnlineOption(
    totalAmount: number,
    venue: any,
  ): PaymentOptionDto {
    return {
      method: PaymentMethod.FULL_ONLINE,
      onlineAmount: totalAmount,
      cashAmount: 0,
      discount: 0,
      label: `Pay ₹${this.formatCurrency(totalAmount)} online`,
      description: 'Secure online payment with instant confirmation',
      confirmationMethod: ConfirmationTrigger.FULL_PAYMENT,
      isRecommended: true,
      benefits: ['Instant confirmation', 'Secure payment', 'Digital receipts'],
    };
  }

  private createMarketplaceOption(
    totalAmount: number,
    venue: any,
  ): PaymentOptionDto {
    return {
      method: PaymentMethod.MARKETPLACE,
      onlineAmount: totalAmount,
      cashAmount: 0,
      discount: 0,
      label: `Pay ₹${this.formatCurrency(totalAmount)} online`,
      description: 'Payment processed securely by platform',
      confirmationMethod: ConfirmationTrigger.FULL_PAYMENT,
      isRecommended: true,
      benefits: [
        'Platform guarantee',
        'Instant confirmation',
        'Full customer protection',
      ],
    };
  }

  private calculateDeposit(
    totalAmount: number,
    depositType: string,
    depositAmount: number,
  ): number {
    const minDeposit = 100000; // ₹1000 minimum
    const maxDeposit = 1000000; // ₹10000 maximum

    let calculated: number;
    if (depositType === 'percentage') {
      calculated = Math.floor((totalAmount * depositAmount) / 100);
    } else {
      calculated = depositAmount; // Fixed amount in cents
    }

    return Math.min(Math.max(calculated, minDeposit), maxDeposit);
  }

  private sortOptionsByPreference(
    options: PaymentOptionDto[],
    preferences: any,
  ): PaymentOptionDto[] {
    return options.sort((a, b) => {
      // Prioritize recommended options first
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;

      // Then sort by customer preference
      if (preferences.cityTier === 'tier3') {
        // In smaller cities, prefer cash options
        return b.cashAmount - a.cashAmount;
      } else {
        // In larger cities, prefer online options
        return b.onlineAmount - a.onlineAmount;
      }
    });
  }

  private calculatePaymentAmounts(
    totalAmount: number,
    method: PaymentMethod,
    venue: any,
  ) {
    switch (method) {
      case PaymentMethod.CASH_FULL:
        const cashDiscount = Math.floor(
          totalAmount * ((venue.cashDiscountPercentage || 0) / 100)
        );
        return {
          onlineAmount: 0,
          cashAmount: totalAmount - cashDiscount,
          cashDiscount,
        };

      case PaymentMethod.DEPOSIT_ONLINE:
        const depositAmount = this.calculateDeposit(
          totalAmount,
          venue.depositType,
          venue.depositAmount,
        );
        return {
          onlineAmount: depositAmount,
          cashAmount: totalAmount - depositAmount,
          cashDiscount: 0,
        };

      case PaymentMethod.FULL_ONLINE:
      case PaymentMethod.MARKETPLACE:
        return {
          onlineAmount: totalAmount,
          cashAmount: 0,
          cashDiscount: 0,
        };

      default:
        throw new BadRequestException(`Unsupported payment method: ${method}`);
    }
  }

  private requiresManualConfirmation(
    method: PaymentMethod,
    venue: any,
  ): boolean {
    if (method === PaymentMethod.CASH_FULL) return true;
    return venue.confirmationTrigger === ConfirmationTrigger.MANUAL_APPROVAL;
  }

  private determineNewStatus(method: PaymentMethod, venue: any): string {
    if (method === PaymentMethod.CASH_FULL) {
      return 'temp_hold'; // Wait for manual confirmation
    }
    if (
      method === PaymentMethod.DEPOSIT_ONLINE &&
      venue.confirmationTrigger === ConfirmationTrigger.DEPOSIT_ONLY
    ) {
      return 'pending'; // Ready for deposit payment
    }
    return 'temp_hold'; // Default
  }

  private async generateNextSteps(
    booking: any,
    method: PaymentMethod,
  ): Promise<NextStep[]> {
    const steps: NextStep[] = [];

    switch (method) {
      case PaymentMethod.CASH_FULL:
        steps.push({
          action: 'venue_contact',
          description: 'Venue will contact you within 2 hours to confirm booking',
          deadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
        });
        steps.push({
          action: 'cash_preparation',
          description: `Prepare ₹${this.formatCurrency(booking.cashAmountDue)} in cash for venue visit`,
          deadline: booking.startTs,
        });
        break;

      case PaymentMethod.DEPOSIT_ONLINE:
        if (booking.onlineAmountDue > 0) {
          steps.push({
            action: 'online_payment',
            description: `Complete ₹${this.formatCurrency(booking.onlineAmountDue)} online payment to confirm booking`,
            deadline: booking.holdExpiresAt,
          });
        }
        if (booking.cashAmountDue > 0) {
          steps.push({
            action: 'cash_preparation',
            description: `Prepare ₹${this.formatCurrency(booking.cashAmountDue)} in cash for venue visit`,
            deadline: booking.startTs,
          });
        }
        break;

      case PaymentMethod.FULL_ONLINE:
      case PaymentMethod.MARKETPLACE:
        steps.push({
          action: 'online_payment',
          description: `Complete ₹${this.formatCurrency(booking.onlineAmountDue)} online payment`,
          deadline: booking.holdExpiresAt,
        });
        break;
    }

    return steps;
  }

  private async updateCustomerPreferences(
    tenantId: string,
    userId: string,
    selection: SelectPaymentMethodDto,
  ) {
    await this.prisma.customerPaymentPreference.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: {
        lastPaymentMethod: selection.selectedMethod,
        totalBookings: { increment: 1 },
        totalOnlinePayments:
          selection.selectedMethod !== PaymentMethod.CASH_FULL
            ? { increment: 1 }
            : undefined,
      },
      create: {
        tenantId,
        userId,
        preferredMethod: selection.selectedMethod.includes('cash')
          ? 'cash'
          : 'online',
        lastPaymentMethod: selection.selectedMethod,
        totalBookings: 1,
        totalOnlinePayments:
          selection.selectedMethod !== PaymentMethod.CASH_FULL ? 1 : 0,
      },
    });
  }

  private async createCommissionRecord(booking: any) {
    const commissionPercentage = booking.venue.platformCommissionPercentage || 10;
    const commissionAmount = Math.floor(
      (booking.totalAmountCents * commissionPercentage) / 100
    );

    await this.prisma.commissionRecord.create({
      data: {
        tenantId: booking.tenantId,
        bookingId: booking.id,
        venueId: booking.venueId,
        bookingAmountCents: booking.totalAmountCents,
        commissionPercentage,
        commissionAmountCents: commissionAmount,
        collectionMethod: this.determineCollectionMethod(booking.paymentMethod),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
  }

  private determineCollectionMethod(paymentMethod: string): string {
    switch (paymentMethod) {
      case PaymentMethod.CASH_FULL:
        return 'monthly_invoice';
      case PaymentMethod.DEPOSIT_ONLINE:
        return 'auto_deduct';
      case PaymentMethod.FULL_ONLINE:
      case PaymentMethod.MARKETPLACE:
        return 'auto_deduct';
      default:
        return 'manual_payment';
    }
  }

  private generatePaymentProfileRecommendation(responses: VenueOnboardingDto) {
    const { paymentPreference, techComfortLevel } = responses;
    const reasoning: string[] = [];

    let profile: VenuePaymentProfile;
    let config: any;

    if (paymentPreference === 'cash_only') {
      profile = VenuePaymentProfile.CASH_ONLY;
      config = {
        allowCashPayments: true,
        cashDiscountPercentage: 3.0, // 3% cash discount
        requiresOnlineDeposit: false,
        depositType: 'percentage',
        depositAmount: 25,
        confirmationTrigger: ConfirmationTrigger.MANUAL_APPROVAL,
        platformCommissionPercentage: 5.0, // Lower commission for cash-only
      };
      reasoning.push('Cash-only venues get lower commission rates');
      reasoning.push('3% cash discount helps attract customers');
    } else if (paymentPreference === 'platform_managed') {
      profile = VenuePaymentProfile.MARKETPLACE;
      config = {
        allowCashPayments: false,
        requiresOnlineDeposit: false,
        platformHandlesPayments: true,
        confirmationTrigger: ConfirmationTrigger.FULL_PAYMENT,
        platformCommissionPercentage: 15.0, // Higher commission for full service
      };
      reasoning.push('Platform handles all payments and customer service');
      reasoning.push('Higher commission for full-service management');
    } else if (paymentPreference === 'online_preferred' && techComfortLevel === 'advanced_tech') {
      profile = VenuePaymentProfile.FULL_ONLINE;
      config = {
        allowCashPayments: false,
        requiresOnlineDeposit: false,
        confirmationTrigger: ConfirmationTrigger.FULL_PAYMENT,
        platformCommissionPercentage: 10.0,
      };
      reasoning.push('Full online payments with your own Razorpay account');
      reasoning.push('You handle payment gateway fees');
    } else if (paymentPreference === 'mostly_cash') {
      profile = VenuePaymentProfile.CASH_WITH_DEPOSIT;
      config = {
        allowCashPayments: true,
        requiresOnlineDeposit: true,
        depositType: 'percentage',
        depositAmount: 20, // 20% deposit
        confirmationTrigger: ConfirmationTrigger.DEPOSIT_ONLY,
        platformCommissionPercentage: 7.0,
      };
      reasoning.push('Small online deposit secures bookings');
      reasoning.push('Most payment still in cash to minimize fees');
    } else {
      // Default to hybrid
      profile = VenuePaymentProfile.HYBRID_FLEXIBLE;
      config = {
        allowCashPayments: true,
        cashDiscountPercentage: 2.0,
        requiresOnlineDeposit: true,
        depositType: 'percentage',
        depositAmount: 25,
        confirmationTrigger: ConfirmationTrigger.DEPOSIT_ONLY,
        platformCommissionPercentage: 8.0,
      };
      reasoning.push('Customers can choose between cash and online payments');
      reasoning.push('Flexible options attract more customers');
    }

    return { profile, config, reasoning };
  }

  private inferCityTier(location?: string): string {
    if (!location) return 'tier2';
    
    const tier1Cities = ['mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'pune', 'hyderabad', 'ahmedabad'];
    const tier2Cities = ['jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam'];
    
    const lowercaseLocation = location.toLowerCase();
    
    if (tier1Cities.some(city => lowercaseLocation.includes(city))) {
      return 'tier1';
    } else if (tier2Cities.some(city => lowercaseLocation.includes(city))) {
      return 'tier2';
    } else {
      return 'tier3';
    }
  }

  private formatCurrency(amountCents: number): string {
    return (amountCents / 100).toLocaleString('en-IN');
  }
}