/**
 * Response DTOs for Booking API endpoints
 * 
 * Design Principles:
 * 1. Never expose sensitive internal data
 * 2. Consistent response format across all endpoints
 * 3. Different views for different user roles
 * 4. Include computed fields for frontend convenience
 */

export class BookingResponseDto {
  id: string;
  bookingNumber: string;
  venueId: string;
  venueName?: string; // Populated from relation
  
  // Customer information (public safe)
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  
  // Timing information
  startTs: Date;
  endTs: Date;
  duration?: number; // Computed: hours between start and end
  
  // Booking details
  status: string;
  paymentStatus: string;
  eventType?: string;
  guestCount?: number;
  specialRequests?: string;
  
  // Pricing
  totalAmountCents?: number;
  currency: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Computed fields for frontend convenience
  isActive?: boolean; // status in ['temp_hold', 'pending', 'confirmed']
  canBeCancelled?: boolean; // Business rule: 24h before start
  holdExpiresAt?: Date; // For temp_hold status
}

/**
 * Extended admin view with additional operational data
 */
export class AdminBookingResponseDto extends BookingResponseDto {
  tenantId: string;
  userId: string;
  idempotencyKey?: string;
  
  // Payment tracking
  payments?: {
    id: string;
    provider: string;
    amountCents: number;
    status: string;
    createdAt: Date;
  }[];
  
  // Audit information
  meta?: Record<string, any>;
  
  // Computed analytics
  isOverdue?: boolean; // Payment overdue
  profitMargin?: number; // Revenue analytics
}

/**
 * Lightweight booking summary for list views
 */
export class BookingSummaryDto {
  id: string;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  startTs: Date;
  endTs: Date;
  status: string;
  totalAmountCents?: number;
  eventType?: string;
}

/**
 * Availability checking response
 */
export class AvailabilityResponseDto {
  isAvailable: boolean;
  conflictingBookings?: BookingSummaryDto[];
  blackoutPeriods?: {
    id: string;
    reason?: string;
    startTs: Date;
    endTs: Date;
    isMaintenance: boolean;
  }[];
  suggestedAlternatives?: {
    startTs: Date;
    endTs: Date;
    isFullDay: boolean;
  }[];
}

/**
 * Booking creation response with additional context
 */
export class CreateBookingResponseDto {
  success: boolean;
  booking: BookingResponseDto;
  
  // Additional context for frontend
  isNewCustomer: boolean;
  paymentRequired: boolean;
  holdExpiresIn?: number; // Minutes until temp hold expires
  
  // Next steps for user
  nextSteps: {
    action: string; // 'payment', 'confirmation', 'wait'
    description: string;
    deadline?: Date;
  }[];
}

/**
 * Bulk operations response
 */
export class BulkBookingResponseDto {
  success: boolean;
  processed: number;
  failed: number;
  
  results: {
    booking?: BookingResponseDto;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
  }[];
}

/**
 * Why separate response DTOs?
 * 
 * 1. **Security**: Never expose sensitive fields (tenantId, internal IDs)
 * 2. **Performance**: Only send required data to frontend
 * 3. **Flexibility**: Different views for different contexts
 * 4. **Future-proof**: Easy to add computed fields
 * 5. **API Documentation**: Clear contract with frontend
 * 
 * Computed Fields Benefits:
 * - Reduce frontend complexity
 * - Consistent business logic
 * - Better user experience
 * - Easier testing
 */