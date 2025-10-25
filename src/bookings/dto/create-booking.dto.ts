import { IsUUID, IsDateString, IsOptional, IsString, IsInt, Min, Max, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerDto {
  @IsString()
  name: string;

  @IsString()
  // Use E.164 strings; UsersService normalizes to +91 when needed
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateBookingDto {
  @IsUUID()
  venueId: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer?: CustomerDto;

  @IsDateString()
  startTs: string; // ISO 8601 UTC

  @IsDateString()
  endTs: string; // ISO 8601 UTC

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  guestCount?: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

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

export class BookingTimeRangeDto {
  @IsUUID()
  @IsOptional()
  venueId?: string;

  @IsDateString()
  startTs: string;

  @IsDateString()
  endTs: string;

  @IsOptional()
  @IsUUID()
  excludeBookingId?: string;
}
