import { ApiProperty } from '@nestjs/swagger';

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

export class BookingResponseDto {
  @ApiProperty({ description: 'Unique booking identifier', example: '123e4567-e89b-12d3-a456-426614174000', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Human-readable booking number', example: 'BK-2024-001234' })
  bookingNumber: string;

  @ApiProperty({ description: 'Venue identifier', example: '123e4567-e89b-12d3-a456-426614174001', format: 'uuid' })
  venueId: string;

  @ApiProperty({ description: 'Venue name (populated from relation)', example: 'Grand Ballroom', required: false })
  venueName?: string; // Populated from relation
  
  // Customer information (public safe)
  @ApiProperty({ 
    description: 'Customer information', 
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174002' },
        name: { type: 'string', example: 'John Doe' },
        phone: { type: 'string', example: '+919876543210' },
        email: { type: 'string', example: 'john.doe@example.com' }
      },
      additionalProperties: false
    }
  })
  customer: { id: string; name: string; phone: string; email?: string };
  
  // Timing information
  @ApiProperty({ description: 'Booking start timestamp', example: '2024-12-25T14:00:00.000Z', format: 'date-time' })
  startTs: Date;

  @ApiProperty({ description: 'Booking end timestamp', example: '2024-12-25T18:00:00.000Z', format: 'date-time' })
  endTs: Date;

  @ApiProperty({ description: 'Booking duration in hours (computed)', example: 4, required: false })
  duration?: number; // Computed: hours between start and end
  
  // Booking details
  @ApiProperty({ description: 'Current booking status', example: 'confirmed', enum: ['temp_hold', 'pending', 'confirmed', 'cancelled', 'expired'] })
  status: string;

  @ApiProperty({ description: 'Payment status', example: 'paid', enum: ['pending', 'partial', 'paid', 'refunded'] })
  paymentStatus: string;

  @ApiProperty({ description: 'Type of event', example: 'wedding', required: false })
  eventType?: string;

  @ApiProperty({ description: 'Expected number of guests', example: 150, required: false })
  guestCount?: number;

  @ApiProperty({ description: 'Special requests or requirements', example: 'Need projector and sound system', required: false })
  specialRequests?: string;
  
  // Pricing
  @ApiProperty({ description: 'Total booking amount in cents', example: 5000000, required: false })
  totalAmountCents?: number;

  @ApiProperty({ description: 'Currency code', example: 'INR' })
  currency: string;
  
  // Metadata
  @ApiProperty({ description: 'Booking creation timestamp', example: '2024-12-20T10:30:00.000Z', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-12-20T15:45:00.000Z', format: 'date-time' })
  updatedAt: Date;
  
  // Computed fields for frontend convenience
  @ApiProperty({ description: 'Whether booking is in active state', example: true, required: false })
  isActive?: boolean; // status in ['temp_hold', 'pending', 'confirmed']

  @ApiProperty({ description: 'Whether booking can be cancelled (24h rule)', example: true, required: false })
  canBeCancelled?: boolean; // Business rule: 24h before start

  @ApiProperty({ description: 'When temp hold expires', example: '2024-12-20T16:00:00.000Z', format: 'date-time', required: false })
  holdExpiresAt?: Date; // For temp_hold status

  // Payment integration fields
  @ApiProperty({ 
    description: 'Payment link information (if payment required)', 
    required: false, 
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'plink_KKBLjhmrasdf23' },
        shortUrl: { type: 'string', example: 'https://rzp.io/i/KKBLjhmr' },
        expiresAt: { type: 'string', format: 'date-time' },
        expiresInMinutes: { type: 'number', example: 15 }
      },
      additionalProperties: false
    }
  })
  paymentLink?: {
    id: string;
    shortUrl: string;
    expiresAt: Date;
    expiresInMinutes: number;
  };

  @ApiProperty({ description: 'Whether payment is required for this booking', example: true, required: false })
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

  @ApiProperty({ description: 'Idempotency key used for creation (admin only)', example: 'booking_20241225_venue123_user456', required: false })
  idempotencyKey?: string;
  
  // Payment tracking
  @ApiProperty({ 
    description: 'Payment history (admin only)', 
    required: false, 
    type: 'array', 
    items: { 
      type: 'object', 
      properties: { 
        id: { type: 'string', format: 'uuid' }, 
        provider: { type: 'string', example: 'razorpay' }, 
        amountCents: { type: 'number', example: 2500000 }, 
        status: { type: 'string', example: 'completed' }, 
        createdAt: { type: 'string', format: 'date-time' } 
      } 
    } 
  })
  payments?: { id: string; provider: string; amountCents: number; status: string; createdAt: Date }[];
  
  // Audit information
  @ApiProperty({ 
    description: 'Additional metadata (admin only)', 
    required: false,
    schema: {
      type: 'object',
      example: { source: 'website', referral: 'google_ads' },
      additionalProperties: true
    }
  })
  meta?: Record<string, any>;
  
  // Computed analytics
  @ApiProperty({ description: 'Whether payment is overdue (admin only)', example: false, required: false })
  isOverdue?: boolean; // Payment overdue

  @ApiProperty({ description: 'Profit margin percentage (admin only)', example: 35.5, required: false })
  profitMargin?: number; // Revenue analytics
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

  @ApiProperty({ description: 'Current booking status', example: 'confirmed', enum: ['temp_hold', 'pending', 'confirmed', 'cancelled', 'expired'] })
  status: string;

  @ApiProperty({ description: 'Total booking amount in cents', example: 5000000, required: false })
  totalAmountCents?: number;

  @ApiProperty({ description: 'Type of event', example: 'wedding', required: false })
  eventType?: string;
}

/**
 * Availability checking response
 */
export class AvailabilityResponseDto {
  @ApiProperty({ description: 'Whether the requested time slot is available', example: true })
  isAvailable: boolean;

  @ApiProperty({ description: 'List of conflicting bookings (if any)', type: [BookingSummaryDto], required: false })
  conflictingBookings?: BookingSummaryDto[];

  @ApiProperty({ 
    description: 'Blackout periods during requested time', 
    required: false, 
    type: 'array', 
    items: { 
      type: 'object', 
      properties: { 
        id: { type: 'string', format: 'uuid' }, 
        reason: { type: 'string', example: 'Maintenance' }, 
        startTs: { type: 'string', format: 'date-time' }, 
        endTs: { type: 'string', format: 'date-time' }, 
        isMaintenance: { type: 'boolean' } 
      } 
    } 
  })
  blackoutPeriods?: { id: string; reason?: string; startTs: Date; endTs: Date; isMaintenance: boolean }[];

  @ApiProperty({ 
    description: 'Alternative time slots that are available', 
    required: false, 
    type: 'array', 
    items: { 
      type: 'object', 
      properties: { 
        startTs: { type: 'string', format: 'date-time' }, 
        endTs: { type: 'string', format: 'date-time' }, 
        isFullDay: { type: 'boolean' } 
      } 
    } 
  })
  suggestedAlternatives?: { startTs: Date; endTs: Date; isFullDay: boolean }[];
}

/**
 * Booking creation response with additional context and payment integration
 */
export class CreateBookingResponseDto {
  @ApiProperty({ description: 'Whether the booking creation was successful', example: true })
  success: boolean;

  @ApiProperty({ description: 'The created booking details', type: BookingResponseDto })
  booking: BookingResponseDto;
  
  // Additional context for frontend
  @ApiProperty({ description: 'Whether a new customer was created', example: false })
  isNewCustomer: boolean;

  @ApiProperty({ description: 'Whether payment is required immediately', example: true })
  paymentRequired: boolean;

  @ApiProperty({ description: 'Minutes until temp hold expires', example: 30, required: false })
  holdExpiresIn?: number; // Minutes until temp hold expires
  
  // Payment integration
  @ApiProperty({ 
    description: 'Payment link details (if payment required)', 
    required: false, 
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'plink_KKBLjhmrasdf23' },
        shortUrl: { type: 'string', example: 'https://rzp.io/i/KKBLjhmr' },
        expiresAt: { type: 'string', format: 'date-time' },
        amount: { type: 'number', example: 5000000 },
        currency: { type: 'string', example: 'INR' }
      },
      additionalProperties: false
    }
  })
  paymentLink?: {
    id: string;
    shortUrl: string;
    expiresAt: Date;
    amount: number;
    currency: string;
  };
  
  // Next steps for user
  @ApiProperty({ 
    description: 'Next steps the user should take', 
    type: 'array', 
    items: { 
      type: 'object', 
      required: ['action', 'description'], 
      properties: { 
        action: { type: 'string', enum: ['payment', 'confirmation', 'wait'] }, 
        description: { type: 'string', example: 'Complete payment within 30 minutes' }, 
        deadline: { type: 'string', format: 'date-time' }, 
        paymentUrl: { type: 'string', example: 'https://rzp.io/i/KKBLjhmr' } 
      } 
    } 
  })
  nextSteps: { action: string; description: string; deadline?: Date; paymentUrl?: string }[];
}

/**
 * Bulk operations response
 */
export class BulkBookingResponseDto {
  @ApiProperty({ description: 'Whether the bulk operation was successful', example: true })
  success: boolean;

  @ApiProperty({ description: 'Number of bookings processed successfully', example: 8 })
  processed: number;

  @ApiProperty({ description: 'Number of bookings that failed to process', example: 2 })
  failed: number;
  
  @ApiProperty({ 
    description: 'Results for each booking in the bulk operation', 
    type: 'array', 
    items: { 
      type: 'object', 
      properties: { 
        booking: { $ref: '#/components/schemas/BookingResponseDto' }, 
        error: { 
          type: 'object', 
          properties: { 
            code: { type: 'string', example: 'VENUE_NOT_AVAILABLE' }, 
            message: { type: 'string', example: 'Venue is not available at the requested time' }, 
            details: { type: 'object' } 
          } 
        } 
      } 
    } 
  })
  results: { booking?: BookingResponseDto; error?: { code: string; message: string; details?: any } }[];
}

/**
 * Why separate response DTOs?
 * 
 * 1. **Security**: Never expose sensitive fields (tenantId, internal IDs)
 * 2. **Performance**: Only send required data to frontend
 * 3. **Flexibility**: Different views for different contexts
 * 4. **Future-proof**: Easy to add computed fields
 * 5. **API Documentation**: Clear contract with frontend
 * 6. **Payment Integration**: Seamless payment flow with booking creation
 * 
 * Computed Fields Benefits:
 * - Reduce frontend complexity
 * - Consistent business logic
 * - Better user experience
 * - Easier testing
 * - Payment link integration
 */