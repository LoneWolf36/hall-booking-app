import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsObject,
  IsArray,
  ValidateNested,
  IsDecimal,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Venue Payment Profile Enums
 */
export enum VenuePaymentProfile {
  CASH_ONLY = 'cash_only',           // No online payments at all
  CASH_WITH_DEPOSIT = 'cash_deposit', // Small online deposit, rest cash
  HYBRID_FLEXIBLE = 'hybrid',         // Customer chooses online/cash
  FULL_ONLINE = 'full_online',       // All payments online
  MARKETPLACE = 'marketplace'         // Platform handles everything
}

export enum PaymentMethod {
  CASH_FULL = 'cash_full',
  DEPOSIT_ONLINE = 'deposit_online', 
  HYBRID_FLEXIBLE = 'hybrid_flexible',
  FULL_ONLINE = 'full_online',
  MARKETPLACE = 'marketplace'
}

export enum ConfirmationTrigger {
  DEPOSIT_ONLY = 'deposit_only',
  FULL_PAYMENT = 'full_payment', 
  MANUAL_APPROVAL = 'manual_approval'
}

/**
 * Payment Option DTO - Represents a payment choice for customer
 */
export class PaymentOptionDto {
  @ApiProperty({
    description: 'Payment method identifier',
    enum: PaymentMethod,
    example: PaymentMethod.DEPOSIT_ONLINE
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({
    description: 'Amount to be paid online (in cents)',
    example: 125000,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  onlineAmount: number;

  @ApiProperty({
    description: 'Amount to be paid in cash (in cents)', 
    example: 375000,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  cashAmount: number;

  @ApiProperty({
    description: 'Discount applied for this payment method (in cents)',
    example: 25000,
    minimum: 0,
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiProperty({
    description: 'Human-readable label for this option',
    example: 'Pay ₹1,250 online + ₹3,750 cash at venue'
  })
  @IsString()
  label: string;

  @ApiProperty({
    description: 'Detailed description of this payment method',
    example: 'Secure your booking with online deposit, pay balance in cash',
    required: false
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'How booking gets confirmed with this method',
    enum: ConfirmationTrigger,
    example: ConfirmationTrigger.DEPOSIT_ONLY
  })
  @IsEnum(ConfirmationTrigger)
  confirmationMethod: ConfirmationTrigger;

  @ApiProperty({
    description: 'Whether this is the recommended option',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @ApiProperty({
    description: 'Benefits/features of this payment method',
    type: [String],
    example: ['Instant confirmation', 'Lower upfront cost', 'Cash discount'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];
}

/**
 * Payment Options Response - List of available payment methods
 */
export class PaymentOptionsResponseDto {
  @ApiProperty({
    description: 'Booking ID these options are for',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid'
  })
  @IsUUID()
  bookingId: string;

  @ApiProperty({
    description: 'Total booking amount (in cents)',
    example: 500000
  })
  @IsInt()
  @Min(0)
  totalAmount: number;

  @ApiProperty({
    description: 'Available payment options',
    type: [PaymentOptionDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentOptionDto)
  options: PaymentOptionDto[];

  @ApiProperty({
    description: 'Venue payment profile',
    enum: VenuePaymentProfile,
    example: VenuePaymentProfile.HYBRID_FLEXIBLE
  })
  @IsEnum(VenuePaymentProfile)
  venueProfile: VenuePaymentProfile;

  @ApiProperty({
    description: 'Customer payment preferences (if known)',
    required: false,
    schema: {
      type: 'object',
      properties: {
        preferredMethod: { type: 'string', example: 'cash' },
        cityTier: { type: 'string', example: 'tier2' },
        totalBookings: { type: 'number', example: 3 }
      },
      additionalProperties: false
    }
  })
  @IsOptional()
  @IsObject()
  customerPreferences?: {
    preferredMethod: string;
    cityTier?: string;
    totalBookings: number;
  };
}

/**
 * Payment Method Selection DTO
 */
export class SelectPaymentMethodDto {
  @ApiProperty({
    description: 'Selected payment method',
    enum: PaymentMethod,
    example: PaymentMethod.DEPOSIT_ONLINE
  })
  @IsEnum(PaymentMethod)
  selectedMethod: PaymentMethod;

  @ApiProperty({
    description: 'Customer acknowledgment of cash payment terms',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  cashTermsAcknowledged?: boolean;

  @ApiProperty({
    description: 'Additional customer preferences',
    required: false,
    schema: {
      type: 'object',
      additionalProperties: true
    }
  })
  @IsOptional()
  @IsObject()
  customerPreferences?: Record<string, any>;
}

/**
 * Venue Payment Configuration DTO
 */
export class VenuePaymentConfigDto {
  @ApiProperty({
    description: 'Venue payment profile',
    enum: VenuePaymentProfile,
    example: VenuePaymentProfile.CASH_WITH_DEPOSIT
  })
  @IsEnum(VenuePaymentProfile)
  paymentProfile: VenuePaymentProfile;

  @ApiProperty({
    description: 'Whether venue accepts cash payments',
    example: true
  })
  @IsBoolean()
  allowCashPayments: boolean;

  @ApiProperty({
    description: 'Cash discount percentage (0-50)',
    example: 3.0,
    minimum: 0,
    maximum: 50,
    required: false
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  cashDiscountPercentage?: number;

  @ApiProperty({
    description: 'Whether online deposit is required',
    example: true
  })
  @IsBoolean()
  requiresOnlineDeposit: boolean;

  @ApiProperty({
    description: 'Deposit calculation type',
    enum: ['percentage', 'fixed'],
    example: 'percentage'
  })
  @IsString()
  depositType: 'percentage' | 'fixed';

  @ApiProperty({
    description: 'Deposit amount (percentage or cents)',
    example: 25,
    minimum: 1
  })
  @IsInt()
  @Min(1)
  depositAmount: number;

  @ApiProperty({
    description: 'Venue has own Razorpay account',
    example: false
  })
  @IsBoolean()
  hasRazorpayAccount: boolean;

  @ApiProperty({
    description: 'Platform handles all payments for venue',
    example: false
  })
  @IsBoolean()
  platformHandlesPayments: boolean;

  @ApiProperty({
    description: 'How bookings get confirmed',
    enum: ConfirmationTrigger,
    example: ConfirmationTrigger.MANUAL_APPROVAL
  })
  @IsEnum(ConfirmationTrigger)
  confirmationTrigger: ConfirmationTrigger;

  @ApiProperty({
    description: 'Platform commission percentage (0-50)',
    example: 10.0,
    minimum: 0,
    maximum: 50
  })
  @IsDecimal({ decimal_digits: '0,2' })
  platformCommissionPercentage: number;

  @ApiProperty({
    description: 'Days before event when full payment is due',
    example: 7,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  paymentDueDaysBeforeEvent: number;
}

/**
 * Cash Payment Recording DTO
 */
export class RecordCashPaymentDto {
  @ApiProperty({
    description: 'Amount paid in cash (in cents)',
    example: 375000,
    minimum: 1
  })
  @IsInt()
  @Min(1)
  amountCents: number;

  @ApiProperty({
    description: 'Cash payment method',
    enum: ['cash', 'cheque', 'bank_transfer', 'upi_cash'],
    example: 'cash'
  })
  @IsString()
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer' | 'upi_cash';

  @ApiProperty({
    description: 'Receipt or reference number',
    example: 'CASH-001234',
    required: false
  })
  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @ApiProperty({
    description: 'Additional notes about the payment',
    example: 'Customer paid exact amount',
    required: false
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'When payment was received (ISO 8601)',
    example: '2024-12-25T14:30:00.000Z',
    format: 'date-time',
    required: false
  })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

/**
 * Venue Onboarding Questionnaire DTO
 */
export class VenueOnboardingDto {
  @ApiProperty({
    description: 'Current payment preference',
    enum: ['cash_only', 'mostly_cash', 'mixed', 'online_preferred', 'platform_managed'],
    example: 'mostly_cash'
  })
  @IsString()
  paymentPreference: 'cash_only' | 'mostly_cash' | 'mixed' | 'online_preferred' | 'platform_managed';

  @ApiProperty({
    description: 'Technical comfort level',
    enum: ['no_tech', 'basic_tech', 'advanced_tech'],
    example: 'basic_tech'
  })
  @IsString()
  techComfortLevel: 'no_tech' | 'basic_tech' | 'advanced_tech';

  @ApiProperty({
    description: 'Current payment methods used',
    type: [String],
    example: ['cash', 'bank_transfer']
  })
  @IsArray()
  @IsString({ each: true })
  currentPaymentMethods: string[];

  @ApiProperty({
    description: 'Monthly booking volume',
    example: 25,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  monthlyBookingVolume: number;

  @ApiProperty({
    description: 'Average booking value in cents',
    example: 500000,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  averageBookingValueCents: number;

  @ApiProperty({
    description: 'Additional responses to questionnaire',
    required: false,
    schema: {
      type: 'object',
      additionalProperties: true
    }
  })
  @IsOptional()
  @IsObject()
  additionalResponses?: Record<string, any>;
}

/**
 * Commission Summary DTO
 */
export class CommissionSummaryDto {
  @ApiProperty({
    description: 'Venue ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  venueId: string;

  @ApiProperty({
    description: 'Total bookings in period',
    example: 15
  })
  @IsInt()
  @Min(0)
  totalBookings: number;

  @ApiProperty({
    description: 'Total booking amount (in cents)',
    example: 7500000
  })
  @IsInt()
  @Min(0)
  totalBookingAmountCents: number;

  @ApiProperty({
    description: 'Total commission owed (in cents)',
    example: 750000
  })
  @IsInt()
  @Min(0)
  totalCommissionCents: number;

  @ApiProperty({
    description: 'Commission already collected (in cents)',
    example: 300000
  })
  @IsInt()
  @Min(0)
  collectedCommissionCents: number;

  @ApiProperty({
    description: 'Outstanding commission (in cents)',
    example: 450000
  })
  @IsInt()
  @Min(0)
  outstandingCommissionCents: number;

  @ApiProperty({
    description: 'Collection method breakdown',
    schema: {
      type: 'object',
      properties: {
        auto_deduct: { type: 'number', example: 200000 },
        monthly_invoice: { type: 'number', example: 250000 },
        cash_settlement: { type: 'number', example: 0 }
      },
      additionalProperties: false
    },
    example: {
      auto_deduct: 200000,
      monthly_invoice: 250000,
      cash_settlement: 0
    }
  })
  @IsObject()
  collectionMethodBreakdown: Record<string, number>;
}