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
  @IsString()
  @MinLength(2, { message: 'Customer name must be at least 2 characters' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsPhoneNumber('IN', { message: 'Phone number must be a valid Indian phone number' })
  @Transform(({ value }) => value?.replace(/[\s\-\(\)]/g, ''))
  phone: string;

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
  @IsUUID(4, { message: 'Venue ID must be a valid UUID' })
  venueId: string;

  // Customer Information - either existing user ID or new customer data
  @IsOptional()
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  userId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customer?: CustomerInfoDto;

  // Booking Time Range
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

  @IsDateString({}, { message: 'End time must be a valid ISO date string' })
  @Transform(({ value }) => {
    // Will be validated against startTs in service layer
    return value;
  })
  endTs: string; // ISO 8601 string, will be converted to Date

  // Event Details
  @IsOptional()
  @IsString()
  @MinLength(2)
  eventType?: string; // wedding, conference, party, etc.

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Guest count must be at least 1' })
  @Max(10000, { message: 'Guest count cannot exceed 10,000' })
  guestCount?: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  // Pricing (optional - can be calculated by service)
  @IsOptional()
  @IsInt()
  @Min(0)
  totalAmountCents?: number;

  // Idempotency and State Management
  @IsOptional()
  @IsString()
  idempotencyKey?: string; // Will be generated if not provided


  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus = BookingStatus.TEMP_HOLD;





  // Additional metadata
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




  @IsDateString()
  startTs: string;

  @IsDateString() 
  endTs: string;

  @IsOptional()
  @IsUUID()
  venueId?: string;

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