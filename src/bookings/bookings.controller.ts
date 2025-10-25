import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  CreateBookingDto,
  BookingTimeRangeDto,
} from './dto/create-booking.dto';
import {
  BookingResponseDto,
  AvailabilityResponseDto,
  CreateBookingResponseDto,
} from './dto/booking-response.dto';

/**
 * Bookings Controller - REST API endpoints for booking management
 * 
 * API Design Principles:
 * 1. RESTful routes with proper HTTP methods
 * 2. Comprehensive input validation
 * 3. Consistent response formats
 * 4. Proper error handling
 * 5. Tenant isolation
 * 6. Idempotency support
 */
@Controller('api/v1/bookings')
@UseInterceptors(ClassSerializerInterceptor)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /api/v1/bookings - Create new booking
   * 
   * This is the core booking creation endpoint:
   * - Supports both existing and new customers
   * - Handles exclusion constraint violations gracefully
   * - Generates sequential booking numbers
   * - Provides idempotency protection
   * 
   * Headers Required:
   * - X-Tenant-Id: Tenant identifier
   * - X-Idempotency-Key: (Optional) Prevents duplicate bookings
   * 
   * Example Request:
   * {
   *   "venueId": "venue-uuid",
   *   "customer": {
   *     "name": "Rahul Sharma", 
   *     "phone": "+919876543210",
   *     "email": "rahul@example.com"
   *   },
   *   "startTs": "2025-12-25T04:30:00.000Z",
   *   "endTs": "2025-12-25T20:30:00.000Z",
   *   "eventType": "wedding",
   *   "guestCount": 300
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @Body(ValidationPipe) createBookingDto: CreateBookingDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<CreateBookingResponseDto> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    // Add idempotency key from header if provided
    if (idempotencyKey && !createBookingDto.idempotencyKey) {
      createBookingDto.idempotencyKey = idempotencyKey;
    }

    return await this.bookingsService.createBooking(tenantId, createBookingDto);
  }

  /**
   * GET /api/v1/bookings/:id - Get booking by ID
   * 
   * Returns full booking details including:
   * - Customer information
   * - Venue details
   * - Payment status
   * - Computed fields (duration, cancellation eligibility)
   */
  @Get(':id')
  async getBookingById(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{
    success: boolean;
    data: BookingResponseDto | null;
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    const booking = await this.bookingsService.getBookingById(tenantId, id);
    
    return {
      success: true,
      data: booking,
    };
  }

  /**
   * POST /api/v1/bookings/check-availability - Check time slot availability
   * 
   * Checks for:
   * - Conflicting bookings (temp_hold, pending, confirmed)
   * - Blackout periods (maintenance, holidays)
   * - Venue-specific constraints
   * 
   * Returns:
   * - Availability status
   * - Conflicting bookings (if any)
   * - Alternative time suggestions
   * 
   * Example Request:
   * {
   *   "venueId": "venue-uuid",
   *   "startTs": "2025-12-25T04:30:00.000Z",
   *   "endTs": "2025-12-25T20:30:00.000Z"
   * }
   */
  @Post('check-availability')
  @HttpCode(HttpStatus.OK)
  async checkAvailability(
    @Body(ValidationPipe) timeRangeDto: BookingTimeRangeDto,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{
    success: boolean;
    data: AvailabilityResponseDto;
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    const availability = await this.bookingsService.checkAvailability(
      tenantId,
      timeRangeDto,
    );

    return {
      success: true,
      data: availability,
    };
  }

  /**
   * GET /api/v1/bookings/venue/:venueId/availability - Get venue availability
   * 
   * Query parameters:
   * - date: ISO date string (YYYY-MM-DD)
   * - days: Number of days to check (default: 7, max: 30)
   * 
   * Returns day-by-day availability status for calendar views
   */
  @Get('venue/:venueId/availability')
  async getVenueAvailability(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Query('date') dateStr?: string,
    @Query('days') daysStr?: string,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{
    success: boolean;
    data: {
      date: string;
      isAvailable: boolean;
      bookings: {
        id: string;
        bookingNumber: string;
        startTs: Date;
        endTs: Date;
        status: string;
        customerName: string;
      }[];
    }[];
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    const date = dateStr ? new Date(dateStr) : new Date();
    const days = Math.min(parseInt(daysStr) || 7, 30); // Max 30 days

    // Validate date
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // For now, return simple response
    // Full implementation would query multiple days efficiently
    return {
      success: true,
      data: [], // TODO: Implement calendar view logic
    };
  }

  /**
   * GET /api/v1/bookings - List bookings with filtering
   * 
   * Query parameters:
   * - status: Filter by booking status
   * - venueId: Filter by venue
   * - startDate: Filter bookings from this date
   * - endDate: Filter bookings until this date
   * - page: Page number (1-based)
   * - limit: Results per page (max 100)
   * 
   * Use cases:
   * - Admin booking management
   * - Customer booking history
   * - Venue utilization reports
   */
  @Get()
  async listBookings(
    @Query('status') status?: string,
    @Query('venueId') venueId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{
    success: boolean;
    data: BookingResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    // TODO: Implement booking listing with filters and pagination
    // This would be a comprehensive query with multiple WHERE conditions
    
    return {
      success: true,
      data: [],
      pagination: {
        page: parseInt(page) || 1,
        limit: Math.min(parseInt(limit) || 20, 100),
        total: 0,
        totalPages: 0,
      },
    };
  }

  /**
   * GET /api/v1/bookings/number/:bookingNumber - Get booking by number
   * 
   * Customer-friendly lookup using booking number instead of UUID
   * Format: PBH-2025-0001
   */
  @Get('number/:bookingNumber')
  async getBookingByNumber(
    @Param('bookingNumber') bookingNumber: string,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{
    success: boolean;
    data: BookingResponseDto | null;
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    // TODO: Implement lookup by booking number
    // This would query: WHERE tenantId = ? AND bookingNumber = ?
    
    return {
      success: true,
      data: null,
    };
  }

  /**
   * POST /api/v1/bookings/:id/confirm - Confirm pending booking
   * 
   * Transitions booking from 'pending' to 'confirmed'
   * Usually triggered after successful payment
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{
    success: boolean;
    data: BookingResponseDto;
    message: string;
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    // TODO: Implement booking confirmation
    // This would update status and send notifications
    
    throw new Error('Not implemented yet');
  }

  /**
   * POST /api/v1/bookings/:id/cancel - Cancel booking
   * 
   * Business rules:
   * - Can only cancel if more than 24h before start time
   * - Refund policy applies based on timing
   * - Notifications sent to customer
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelData: { reason?: string },
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{
    success: boolean;
    data: BookingResponseDto;
    message: string;
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    // TODO: Implement booking cancellation
    // This would update status and handle refunds
    
    throw new Error('Not implemented yet');
  }
}

/**
 * Controller Design Decisions:
 * 
 * 1. **Consistent Response Format**: All endpoints return { success, data, message? }
 * 2. **Proper HTTP Status Codes**: 201 for creation, 200 for success, etc.
 * 3. **Header-based Tenant ID**: Consistent with user management API
 * 4. **Idempotency Support**: Both header and body-based keys
 * 5. **Input Validation**: DTOs with comprehensive validation rules
 * 6. **Error Handling**: Proper HTTP exceptions with meaningful messages
 * 7. **Future-ready**: Placeholder methods for common booking operations
 * 
 * API Documentation:
 * All endpoints are designed to be OpenAPI/Swagger compatible
 * with clear parameter descriptions and example requests/responses.
 */