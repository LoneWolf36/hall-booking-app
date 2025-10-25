import { Injectable, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { ValidationService } from './validation.service';

/**
 * Error Handler Service - Centralized error processing for database constraints
 * 
 * Refactored to eliminate duplicate utility methods by using ValidationService
 */
@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);

  constructor(private readonly validationService: ValidationService) {}

  /**
   * Handle booking-specific database errors with context
   */
  handleBookingError(error: any, context: {
    operation: 'create' | 'update' | 'delete';
    venueId?: string;
    startTs?: Date;
    endTs?: Date;
    bookingId?: string;
  }): Error {
    const { operation, venueId, startTs, endTs, bookingId } = context;
    
    // Log the original error for debugging
    this.logger.error('Database error in booking operation', {
      code: error.code,
      message: error.message,
      operation,
      venueId,
      startTs: startTs?.toISOString(),
      endTs: endTs?.toISOString(),
      bookingId,
    });

    // Handle PostgreSQL exclusion constraint violation (our tstzrange overlap prevention)
    if (error.code === '23P01') {
      return this.handleExclusionConstraintViolation(error, context);
    }

    // Handle Prisma unique constraint violations
    if (error.code === 'P2002') {
      return this.handlePrismaUniqueConstraint(error, context);
    }

    // Handle PostgreSQL unique constraint violations
    if (error.code === '23505') {
      return this.handleUniqueConstraintViolation(error, context);
    }

    // Handle foreign key violations
    if (error.code === '23503' || error.code === 'P2003') {
      return this.handleForeignKeyViolation(error, context);
    }

    // Handle check constraint violations
    if (error.code === '23514') {
      return this.handleCheckConstraintViolation(error, context);
    }

    // If it's already a NestJS exception, pass it through
    if (error.status && error.response) {
      return error;
    }

    // Default handling for unknown errors
    this.logger.error('Unhandled database error', error);
    return new BadRequestException('Operation failed due to data constraint. Please check your input and try again.');
  }

  /**
   * Handle exclusion constraint violations (our double-booking prevention)
   */
  private handleExclusionConstraintViolation(error: any, context: any): ConflictException {
    const { venueId, startTs, endTs } = context;
    
    // Parse constraint name to provide specific guidance
    const constraintName = this.extractConstraintName(error.message);
    
    if (constraintName === 'no_booking_overlap') {
      const timeRange = startTs && endTs 
        ? ` for ${this.validationService.formatDateRange(startTs, endTs)}`
        : '';
      
      return new ConflictException({
        message: 'This time slot is no longer available',
        details: `Another booking exists that conflicts with your requested time${timeRange}`,
        code: 'BOOKING_TIME_CONFLICT',
        suggestions: [
          'Check availability for nearby time slots',
          'Consider alternative dates',
          'Contact venue for assistance'
        ]
      });
    }

    // Generic exclusion constraint message
    return new ConflictException({
      message: 'Resource conflict detected',
      details: 'The requested operation conflicts with existing data',
      code: 'RESOURCE_CONFLICT'
    });
  }

  /**
   * Handle Prisma unique constraint violations
   */
  private handlePrismaUniqueConstraint(error: any, context: any): ConflictException {
    const { operation } = context;
    const fields = error.meta?.target || [];
    
    if (fields.includes('bookingNumber')) {
      return new ConflictException({
        message: 'Booking number conflict',
        details: 'This booking number already exists. Please try again.',
        code: 'DUPLICATE_BOOKING_NUMBER'
      });
    }

    if (fields.includes('idempotencyKey')) {
      return new ConflictException({
        message: 'Duplicate request detected',
        details: 'This request has already been processed with the same idempotency key',
        code: 'DUPLICATE_IDEMPOTENCY_KEY'
      });
    }

    // Generic unique constraint message
    return new ConflictException({
      message: 'Duplicate data detected',
      details: `A record with the same ${fields.join(', ')} already exists`,
      code: 'DUPLICATE_CONSTRAINT'
    });
  }

  /**
   * Handle PostgreSQL unique constraint violations
   */
  private handleUniqueConstraintViolation(error: any, context: any): ConflictException {
    const constraintName = this.extractConstraintName(error.message);
    
    return new ConflictException({
      message: 'Duplicate data detected',
      details: `Unique constraint violation: ${constraintName}`,
      code: 'UNIQUE_CONSTRAINT_VIOLATION'
    });
  }

  /**
   * Handle foreign key constraint violations
   */
  private handleForeignKeyViolation(error: any, context: any): BadRequestException {
    const { operation } = context;
    
    if (operation === 'delete') {
      return new BadRequestException({
        message: 'Cannot delete record',
        details: 'This record is referenced by other data and cannot be deleted',
        code: 'FOREIGN_KEY_REFERENCE_EXISTS'
      });
    }
    
    return new BadRequestException({
      message: 'Invalid reference',
      details: 'One or more referenced records do not exist',
      code: 'FOREIGN_KEY_VIOLATION'
    });
  }

  /**
   * Handle check constraint violations
   */
  private handleCheckConstraintViolation(error: any, context: any): BadRequestException {
    return new BadRequestException({
      message: 'Data validation failed',
      details: 'The provided data violates business rules',
      code: 'CHECK_CONSTRAINT_VIOLATION'
    });
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Extract constraint name from PostgreSQL error message
   */
  private extractConstraintName(message: string): string | null {
    const matches = message.match(/constraint "([^"]+)"/); 
    return matches ? matches[1] : null;
  }

  /**
   * Check if error is a database constraint violation
   */
  public isDatabaseConstraintError(error: any): boolean {
    const constraintCodes = ['23P01', '23505', '23503', '23514', 'P2002', 'P2003'];
    return constraintCodes.includes(error.code);
  }

  /**
   * Extract user-friendly message for API responses
   */
  public getPublicMessage(error: any): string {
    if (error.response && typeof error.response === 'object' && error.response.message) {
      return error.response.message;
    }
    
    return error.message || 'An unexpected error occurred';
  }
}