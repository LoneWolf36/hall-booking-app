import {
  IsString,
  IsDateString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  IsPhoneNumber,
  IsEmail,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum BookingStatus {
  TEMP_HOLD = 'temp_hold',
  PENDING = 'pending', 
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid', 
  REFUNDED = 'refunded',
}

/**
 * Customer information for booking creation
 * Used when customer doesn't exist or needs to be updated
 */
export class CustomerInfoDto {
  @ApiProperty({
    description: 'Full name of the customer',
    example: 'John Doe',
    minLength: 2
  })
  @IsString()
  @MinLength(2, { message: 'Customer name must be at least 2 characters' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    description: 'Indian phone number with country code',
    example: '+919876543210'
  })
  @IsPhoneNumber('IN', { message: 'Phone number must be a valid Indian phone number' })
  @Transform(({ value }) => value?.replace(/[\s\-\(\)]/g, ''))
  phone: string;

  @ApiProperty({
    description: 'Email address (optional)',
    example: 'john.doe@example.com',
    required: false
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;
}

/**
 * Main DTO for creating a new booking
 * 
 * Design Decisions:
 * 1. Supports both existing and new customer creation
 * 2. Timestamp validation ensures proper Indian timezone handling
 * 3. Venue validation ensures proper tenant isolation
 * 4. Event details capture business requirements
 * 5. Idempotency key prevents duplicate bookings
 */
export class CreateBookingDto {
  @ApiProperty({
    description: 'UUID of the venue to book',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid'
  })
  @IsUUID(4, { message: 'Venue ID must be a valid UUID' })
  venueId: string;

  // Customer Information - either existing user ID or new customer data
  @ApiProperty({
    description: 'UUID of existing user (optional if customer info provided)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  userId?: string;

  @ApiProperty({
    description: 'New customer information (optional if userId provided)',
    type: CustomerInfoDto,
    required: false
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customer?: CustomerInfoDto;

  // Booking Time Range
  @ApiProperty({
    description: 'Booking start time (ISO 8601 format, must be in future)',
    example: '2024-12-25T14:00:00.000Z',
    format: 'date-time'
  })
  @IsDateString({}, { message: 'Start time must be a valid ISO date string' })
  @Transform(({ value }) => {
    // Validate that the date is in future
    const date = new Date(value);
    if (date <= new Date()) {
      throw new Error('Start time must be in the future');
    }
    return value;
  })
  startTs: string; // ISO 8601 string, will be converted to Date

  @ApiProperty({
    description: 'Booking end time (ISO 8601 format, must be after start time)',
    example: '2024-12-25T18:00:00.000Z',
    format: 'date-time'
  })
  @IsDateString({}, { message: 'End time must be a valid ISO date string' })
  @Transform(({ value }) => {
    // Will be validated against startTs in service layer
    return value;
  })
  endTs: string; // ISO 8601 string, will be converted to Date

  // Event Details
  @ApiProperty({
    description: 'Type of event (wedding, conference, party, etc.)',
    example: 'wedding',
    minLength: 2,
    required: false
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  eventType?: string; // wedding, conference, party, etc.

  @ApiProperty({
    description: 'Expected number of guests',
    example: 150,
    minimum: 1,
    maximum: 10000,
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Guest count must be at least 1' })
  @Max(10000, { message: 'Guest count cannot exceed 10,000' })
  guestCount?: number;

  @ApiProperty({
    description: 'Any special requests or requirements',
    example: 'Need projector and sound system',
    required: false
  })
  @IsOptional()
  @IsString()
  specialRequests?: string;

  // Pricing (optional - can be calculated by service)
  @ApiProperty({
    description: 'Total booking amount in cents (optional, can be calculated)',
    example: 5000000,
    minimum: 0,
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalAmountCents?: number;

  // Idempotency and State Management
  @ApiProperty({
    description: 'Unique key to prevent duplicate bookings (auto-generated if not provided)',
    example: 'booking_20241225_venue123_user456',
    required: false
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string; // Will be generated if not provided

  @ApiProperty({
    description: 'Initial booking status',
    enum: BookingStatus,
    example: BookingStatus.TEMP_HOLD,
    default: BookingStatus.TEMP_HOLD,
    required: false
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus = BookingStatus.TEMP_HOLD;

  // Additional metadata
  @ApiProperty({
    description: 'Additional metadata as key-value pairs',
    example: { source: 'website', referral: 'google_ads' },
    required: false
  })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

}

/**
 * Validation Rules Explained:
 * 
 * 1. **Venue ID**: Must exist and belong to tenant
 * 2. **Customer Data**: Either userId OR customer info required
 * 3. **Time Range**: Start must be future, end must be after start
 * 4. **Guest Count**: Reasonable limits for hall capacity
 * 5. **Event Type**: Optional categorization for reporting
 * 6. **Idempotency**: Prevents duplicate submissions
 * 
 * Custom Validation:
 * - Time range validation happens in service layer
 * - Venue capacity vs guest count checked in business logic
 * - Availability checking uses database constraints
 */

/**
 * DTO for booking time range queries
 * Used for availability checking
 */
export class BookingTimeRangeDto {

  @ApiProperty({
    description: 'Query start time (ISO 8601 format)',
    example: '2024-12-25T00:00:00.000Z',
    format: 'date-time'
  })
  @IsDateString()
  startTs: string;

  @ApiProperty({
    description: 'Query end time (ISO 8601 format)',
    example: '2024-12-25T23:59:59.000Z',
    format: 'date-time'
  })
  @IsDateString() 
  endTs: string;

  @ApiProperty({
    description: 'Filter by specific venue (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiProperty({
    description: 'Exclude specific booking from results (for update operations)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsUUID()
  excludeBookingId?: string; // For update operations
}

/**
 * Why separate DTOs?
 * 
 * 1. **CreateBookingDto**: Full booking creation with all validation
 * 2. **CustomerInfoDto**: Reusable customer data structure
 * 3. **BookingTimeRangeDto**: Lightweight for availability queries
 * 4. **Enums**: Type-safe status management
 */