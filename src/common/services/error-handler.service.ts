import { Injectable, Logger, ConflictException, BadRequestException } from '@nestjs/common';

/**
 * Error Handler Service - Centralized error processing for database constraints
 * 
 * Teaching Points:
 * 1. Why centralized error handling improves maintainability
 * 2. How to map database-specific errors to business errors
 * 3. Proper logging strategies for debugging
 * 4. Error message internationalization preparation
 * 
 * Key Database Error Codes:
 * - 23P01: PostgreSQL exclusion constraint violation (our double-booking prevention)
 * - P2002: Prisma unique constraint violation
 * - 23505: PostgreSQL unique constraint violation
 * - 23503: Foreign key constraint violation
 */
@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);

  /**
   * Handle booking-specific database errors with context
   * 
   * This method transforms low-level database errors into business-friendly messages
   * that clients can understand and act upon.
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
   * 
   * Teaching: This is the heart of our double-booking prevention system.
   * The exclusion constraint prevents overlapping time ranges at the database level.
   */
  private handleExclusionConstraintViolation(error: any, context: any): ConflictException {
    const { venueId, startTs, endTs } = context;
    
    // Parse constraint name to provide specific guidance
    const constraintName = this.extractConstraintName(error.message);
    
    if (constraintName === 'no_booking_overlap') {
      const timeRange = startTs && endTs 
        ? ` for ${this.formatDateRange(startTs, endTs)}`
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
   * Format date range for human-readable error messages
   */
  private formatDateRange(startTs: Date, endTs: Date): string {
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    const start = startTs.toLocaleDateString('en-IN', formatOptions);
    const end = endTs.toLocaleDateString('en-IN', formatOptions);
    
    return `${start} to ${end}`;
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

/**
 * Teaching Notes on Database Error Handling:
 * 
 * 1. **Error Code Mapping**: Each database has specific error codes.
 *    PostgreSQL uses numeric codes (23P01), Prisma uses alphanumeric (P2002).
 * 
 * 2. **Context Matters**: The same error code can mean different things
 *    in different contexts. That's why we pass operation context.
 * 
 * 3. **User Experience**: Transform technical errors into actionable messages.
 *    Instead of "23P01 exclusion constraint violation", say "Time slot unavailable".
 * 
 * 4. **Logging Strategy**: Log technical details for developers,
 *    return business-friendly messages to users.
 * 
 * 5. **Internationalization**: Structure errors as objects to support
 *    multiple languages in the future.
 * 
 * 6. **Graceful Degradation**: Always provide a fallback error message
 *    for unexpected cases.
 */