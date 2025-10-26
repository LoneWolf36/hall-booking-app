import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTOs for Booking API endpoints
 *
 * Design Principles:
 * 1. Never expose sensitive internal data
 * 2. Consistent response format across all endpoints
 * 3. Different views for different user roles
 * 4. Include computed fields for frontend convenience
 * 5. Payment integration for seamless booking flow
 */

/**
 * Shared nested DTOs
 */
export class CustomerPublicDto {
  @ApiProperty({ description: 'Customer identifier', example: '123e4567-e89b-12d3-a456-426614174002', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'Customer phone', example: '+919876543210' })
  phone: string;

  @ApiPropertyOptional({ description: 'Customer email', example: 'john.doe@example.com' })
  email?: string;
}

export class PaymentLinkDto {
  @ApiProperty({ description: 'Payment link id', example: 'plink_KKBLjhmrasdf23' })
  id: string;

  @ApiProperty({ description: 'Short payment URL', example: 'https://rzp.io/i/KKBLjhmr' })
  shortUrl: string;

  @ApiProperty({ description: 'Expiration timestamp', example: '2024-12-20T16:00:00.000Z', format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({ description: 'Minutes until expiration', example: 15 })
  expiresInMinutes: number;
}

export class PaymentHistoryItemDto {
  @ApiProperty({ description: 'Payment record id', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174111' })
  id: string;

  @ApiProperty({ description: 'Payment provider', example: 'razorpay' })
  provider: string;

  @ApiProperty({ description: 'Amount in cents', example: 2500000 })
  amountCents: number;

  @ApiProperty({ description: 'Payment status', example: 'completed' })
  status: string;

  @ApiProperty({ description: 'Creation timestamp', format: 'date-time', example: '2024-12-20T10:30:00.000Z' })
  createdAt: Date;
}

export class BlackoutPeriodDto {
  @ApiProperty({ description: 'Blackout id', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174222' })
  id: string;

  @ApiPropertyOptional({ description: 'Reason for blackout', example: 'Maintenance' })
  reason?: string;

  @ApiProperty({ description: 'Start timestamp', format: 'date-time', example: '2024-12-25T14:00:00.000Z' })
  startTs: Date;

  @ApiProperty({ description: 'End timestamp', format: 'date-time', example: '2024-12-25T18:00:00.000Z' })
  endTs: Date;

  @ApiProperty({ description: 'Whether this is maintenance', example: true })
  isMaintenance: boolean;
}

export class SuggestedAlternativeDto {
  @ApiProperty({ description: 'Alternative start', format: 'date-time', example: '2024-12-26T14:00:00.000Z' })
  startTs: Date;

  @ApiProperty({ description: 'Alternative end', format: 'date-time', example: '2024-12-26T18:00:00.000Z' })
  endTs: Date;

  @ApiProperty({ description: 'Is full-day option', example: false })
  isFullDay: boolean;
}

export class NextStepDto {
  @ApiProperty({ description: 'Action type', enum: ['payment', 'confirmation', 'wait'], example: 'payment' })
  action: string;

  @ApiProperty({ description: 'What the user should do', example: 'Complete payment within 30 minutes' })
  description: string;

  @ApiPropertyOptional({ description: 'Deadline for the action', format: 'date-time', example: '2024-12-20T16:00:00.000Z' })
  deadline?: Date;

  @ApiPropertyOptional({ description: 'Payment URL if action is payment', example: 'https://rzp.io/i/KKBLjhmr' })
  paymentUrl?: string;
}

export class BulkErrorDto {
  @ApiProperty({ description: 'Error code', example: 'VENUE_NOT_AVAILABLE' })
  code: string;

  @ApiProperty({ description: 'Error message', example: 'Venue is not available at the requested time' })
  message: string;

  @ApiPropertyOptional({
    description: 'Additional error details',
    type: 'object',
    additionalProperties: true,
  })
  details?: Record<string, any>;
}

/**
 * Core DTOs
 */
export class BookingResponseDto {
  @ApiProperty({ description: 'Unique booking identifier', example: '123e4567-e89b-12d3-a456-426614174000', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Human-readable booking number', example: 'BK-2024-001234' })
  bookingNumber: string;

  @ApiProperty({ description: 'Venue identifier', example: '123e4567-e89b-12d3-a456-426614174001', format: 'uuid' })
  venueId: string;

  @ApiPropertyOptional({ description: 'Venue name (populated from relation)', example: 'Grand Ballroom' })
  venueName?: string;

  @ApiProperty({ description: 'Customer information', type: () => CustomerPublicDto })
  customer: CustomerPublicDto;

  @ApiProperty({ description: 'Booking start timestamp', example: '2024-12-25T14:00:00.000Z', format: 'date-time' })
  startTs: Date;

  @ApiProperty({ description: 'Booking end timestamp', example: '2024-12-25T18:00:00.000Z', format: 'date-time' })
  endTs: Date;

  @ApiPropertyOptional({ description: 'Booking duration in hours (computed)', example: 4 })
  duration?: number;

  @ApiProperty({
    description: 'Current booking status',
    example: 'confirmed',
    enum: ['temp_hold', 'pending', 'confirmed', 'cancelled', 'expired'],
  })
  status: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'paid',
    enum: ['pending', 'partial', 'paid', 'refunded'],
  })
  paymentStatus: string;

  @ApiPropertyOptional({ description: 'Type of event', example: 'wedding' })
  eventType?: string;

  @ApiPropertyOptional({ description: 'Expected number of guests', example: 150 })
  guestCount?: number;

  @ApiPropertyOptional({ description: 'Special requests or requirements', example: 'Need projector and sound system' })
  specialRequests?: string;

  @ApiPropertyOptional({ description: 'Total booking amount in cents', example: 5000000 })
  totalAmountCents?: number;

  @ApiProperty({ description: 'Currency code', example: 'INR' })
  currency: string;

  @ApiProperty({ description: 'Booking creation timestamp', example: '2024-12-20T10:30:00.000Z', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-12-20T15:45:00.000Z', format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Whether booking is in active state', example: true })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether booking can be cancelled (24h rule)', example: true })
  canBeCancelled?: boolean;

  @ApiPropertyOptional({ description: 'When temp hold expires', example: '2024-12-20T16:00:00.000Z', format: 'date-time' })
  holdExpiresAt?: Date;

  @ApiPropertyOptional({ description: 'Payment link information (if payment required)', type: () => PaymentLinkDto })
  paymentLink?: PaymentLinkDto;

  @ApiPropertyOptional({ description: 'Whether payment is required for this booking', example: true })
  requiresPayment?: boolean;
}

/**
 * Extended admin view with additional operational data
 */
export class AdminBookingResponseDto extends BookingResponseDto {
  @ApiProperty({ description: 'Tenant identifier (admin only)', example: '123e4567-e89b-12d3-a456-426614174003', format: 'uuid' })
  tenantId: string;

  @ApiProperty({ description: 'User identifier (admin only)', example: '123e4567-e89b-12d3-a456-426614174004', format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ description: 'Idempotency key used for creation (admin only)', example: 'booking_20241225_venue123_user456' })
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Payment history (admin only)', type: () => [PaymentHistoryItemDto] })
  payments?: PaymentHistoryItemDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata (admin only)',
    type: 'object',
    additionalProperties: true,
    example: { source: 'website', referral: 'google_ads' },
  })
  meta?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether payment is overdue (admin only)', example: false })
  isOverdue?: boolean;

  @ApiPropertyOptional({ description: 'Profit margin percentage (admin only)', example: 35.5 })
  profitMargin?: number;
}

/**
 * Lightweight booking summary for list views
 */
export class BookingSummaryDto {
  @ApiProperty({ description: 'Unique booking identifier', example: '123e4567-e89b-12d3-a456-426614174000', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Human-readable booking number', example: 'BK-2024-001234' })
  bookingNumber: string;

  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Customer phone number', example: '+919876543210' })
  customerPhone: string;

  @ApiProperty({ description: 'Booking start timestamp', example: '2024-12-25T14:00:00.000Z', format: 'date-time' })
  startTs: Date;

  @ApiProperty({ description: 'Booking end timestamp', example: '2024-12-25T18:00:00.000Z', format: 'date-time' })
  endTs: Date;

  @ApiProperty({
    description: 'Current booking status',
    example: 'confirmed',
    enum: ['temp_hold', 'pending', 'confirmed', 'cancelled', 'expired'],
  })
  status: string;

  @ApiPropertyOptional({ description: 'Total booking amount in cents', example: 5000000 })
  totalAmountCents?: number;

  @ApiPropertyOptional({ description: 'Type of event', example: 'wedding' })
  eventType?: string;
}

/**
 * Availability checking response
 */
export class AvailabilityResponseDto {
  @ApiProperty({ description: 'Whether the requested time slot is available', example: true })
  isAvailable: boolean;

  @ApiPropertyOptional({ description: 'List of conflicting bookings (if any)', type: () => [BookingSummaryDto] })
  conflictingBookings?: BookingSummaryDto[];

  @ApiPropertyOptional({ description: 'Blackout periods during requested time', type: () => [BlackoutPeriodDto] })
  blackoutPeriods?: BlackoutPeriodDto[];

  @ApiPropertyOptional({ description: 'Alternative time slots that are available', type: () => [SuggestedAlternativeDto] })
  suggestedAlternatives?: SuggestedAlternativeDto[];
}

/**
 * Booking creation response with additional context and payment integration
 */
export class CreateBookingResponseDto {
  @ApiProperty({ description: 'Whether the booking creation was successful', example: true })
  success: boolean;

  @ApiProperty({ description: 'The created booking details', type: () => BookingResponseDto })
  booking: BookingResponseDto;

  @ApiProperty({ description: 'Whether a new customer was created', example: false })
  isNewCustomer: boolean;

  @ApiProperty({ description: 'Whether payment is required immediately', example: true })
  paymentRequired: boolean;

  @ApiPropertyOptional({ description: 'Minutes until temp hold expires', example: 30 })
  holdExpiresIn?: number;

  @ApiPropertyOptional({ description: 'Payment link details (if payment required)', type: () => PaymentLinkDto })
  paymentLink?: PaymentLinkDto;

  @ApiProperty({ description: 'Next steps the user should take', type: () => [NextStepDto] })
  nextSteps: NextStepDto[];
}

/**
 * Bulk operations response
 */
export class BulkResultDto {
  @ApiPropertyOptional({ description: 'Processed booking', type: () => BookingResponseDto })
  booking?: BookingResponseDto;

  @ApiPropertyOptional({ description: 'Error object for failed item', type: () => BulkErrorDto })
  error?: BulkErrorDto;
}

export class BulkBookingResponseDto {
  @ApiProperty({ description: 'Whether the bulk operation was successful', example: true })
  success: boolean;

  @ApiProperty({ description: 'Number of bookings processed successfully', example: 8 })
  processed: number;

  @ApiProperty({ description: 'Number of bookings that failed to process', example: 2 })
  failed: number;

  @ApiProperty({
    description: 'Results for each booking in the bulk operation',
    type: () => [BulkResultDto],
  })
  results: BulkResultDto[];
}
