/**
 * Admin Module DTOs
 * 
 * Data Transfer Objects for admin operations.
 * Phase5-T-037
 */

import { IsString, IsOptional, IsUUID, IsIn } from 'class-validator';

/**
 * Approve booking DTO
 */
export class ApproveBookingDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Reject booking DTO
 */
export class RejectBookingDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Record cash payment DTO
 */
export class RecordCashPaymentDto {
  @IsUUID()
  bookingId: string;

  paidAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Admin booking filter DTO
 */
export class AdminBookingFilterDto {
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'rejected', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsIn(['cash', 'online', 'partial'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  search?: string; // Booking number, customer name, or phone

  page?: number;
  limit?: number;
}
