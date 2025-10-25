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
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
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
import { RequireIdempotency, OptionalIdempotency } from '../common/decorators/idempotent.decorator';

/**
 * Bookings Controller - REST API endpoints for booking management
 * 
 * Enhanced with idempotency support for production reliability:
 * - Critical operations require idempotency keys
 * - Optional idempotency for query operations
 * - Automatic duplicate request handling
 * - Swagger documentation integration
 */
@ApiTags('Bookings')
@Controller('api/v1/bookings')
@UseInterceptors(ClassSerializerInterceptor)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /api/v1/bookings - Create new booking
   * 
   * CRITICAL OPERATION - Requires idempotency key to prevent duplicate bookings
   * This is essential for payment processing and avoiding double-bookings
   * 
   * Teaching Point: Why idempotency is critical for booking systems:
   * 1. Network timeouts can cause duplicate requests
   * 2. User double-clicking submit buttons
   * 3. Mobile app retry logic
   * 4. Payment gateway webhooks
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireIdempotency() // This decorator ensures X-Idempotency-Key is required
  @ApiOperation({
    summary: 'Create new booking',
    description: 'Creates a new hall booking with exclusion constraint protection. Requires idempotency key for safety.',
  })
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Tenant identifier for multi-tenant isolation',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully',
    type: CreateBookingResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Time slot conflict - booking already exists for this time',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or missing idempotency key',
  })
  async createBooking(
    @Headers('x-tenant-id') tenantId: string,
    @Body(ValidationPipe) createBookingDto: CreateBookingDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<CreateBookingResponseDto> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    // The idempotency interceptor will validate the key format
    // We just need to pass it to the service if provided
    if (idempotencyKey && !createBookingDto.idempotencyKey) {
      createBookingDto.idempotencyKey = idempotencyKey;
    }

    return await this.bookingsService.createBooking(tenantId, createBookingDto);
  }

  /**
   * GET /api/v1/bookings/:id - Get booking by ID
   * 
   * Read-only operation - Optional idempotency for caching benefits
   */
  @Get(':id')
  @OptionalIdempotency() // Helpful for caching but not critical
  @ApiOperation({
    summary: 'Get booking details by ID',
    description: 'Retrieves full booking information including customer and venue details',
  })
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Tenant identifier',
    required: true,
  })
  async getBookingById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
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
   * Query operation - Optional idempotency for performance
   */
  @Post('check-availability')
  @HttpCode(HttpStatus.OK)
  @OptionalIdempotency() // Useful for caching availability checks
  @ApiOperation({
    summary: 'Check venue availability for time range',
    description: 'Checks for conflicts and returns availability status with suggestions',
  })
  async checkAvailability(
    @Headers('x-tenant-id') tenantId: string,
    @Body(ValidationPipe) timeRangeDto: BookingTimeRangeDto,
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
   * POST /api/v1/bookings/:id/confirm - Confirm pending booking
   * 
   * CRITICAL STATE CHANGE - Requires idempotency to prevent double-confirmation
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequireIdempotency() // Critical - prevents double confirmation
  @ApiOperation({
    summary: 'Confirm pending booking',
    description: 'Transitions booking from pending to confirmed status. Usually triggered after payment.',
  })
  async confirmBooking(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{
    success: boolean;
    data: BookingResponseDto;
    message: string;
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    // TODO: Implement booking confirmation logic
    throw new Error('Booking confirmation not implemented yet');
  }

  /**
   * POST /api/v1/bookings/:id/cancel - Cancel booking
   * 
   * CRITICAL STATE CHANGE - Requires idempotency to prevent double-cancellation
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireIdempotency() // Critical - prevents double cancellation and refunds
  @ApiOperation({
    summary: 'Cancel booking',
    description: 'Cancels booking and processes refund according to policy',
  })
  async cancelBooking(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelData: { reason?: string },
  ): Promise<{
    success: boolean;
    data: BookingResponseDto;
    message: string;
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    // TODO: Implement booking cancellation logic
    throw new Error('Booking cancellation not implemented yet');
  }

  /**
   * GET operations below - No idempotency needed as they don't change state
   */

  @Get('venue/:venueId/availability')
  @ApiOperation({
    summary: 'Get venue availability calendar',
    description: 'Returns day-by-day availability for calendar views',
  })
  async getVenueAvailability(
    @Headers('x-tenant-id') tenantId: string,
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Query('date') dateStr?: string,
    @Query('days') daysStr?: string,
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
    const days = Math.min(parseInt(daysStr ?? '7', 10) || 7, 30);

    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    return {
      success: true,
      data: [], // TODO: Implement calendar view logic
    };
  }

  @Get()
  @ApiOperation({
    summary: 'List bookings with filters',
    description: 'Returns paginated list of bookings with filtering options',
  })
  async listBookings(
    @Headers('x-tenant-id') tenantId: string,
    @Query('status') status?: string,
    @Query('venueId') venueId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
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

    return {
      success: true,
      data: [],
      pagination: {
        page: parseInt(page ?? '1', 10) || 1,
        limit: Math.min(parseInt(limit ?? '20', 10) || 20, 100),
        total: 0,
        totalPages: 0,
      },
    };
  }

  @Get('number/:bookingNumber')
  @ApiOperation({
    summary: 'Get booking by booking number',
    description: 'Customer-friendly lookup using booking number (e.g., PBH-2025-0001)',
  })
  async getBookingByNumber(
    @Headers('x-tenant-id') tenantId: string,
    @Param('bookingNumber') bookingNumber: string,
  ): Promise<{
    success: boolean;
    data: BookingResponseDto | null;
  }> {
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    return {
      success: true,
      data: null, // TODO: Implement lookup by booking number
    };
  }
}

/**
 * Teaching Notes on Idempotency Patterns:
 * 
 * 1. **Critical vs Optional**: 
 *    - CREATE, UPDATE, DELETE operations → Require idempotency
 *    - READ operations → Optional idempotency for caching
 * 
 * 2. **State Changes**:
 *    - Booking creation → Critical (prevents double bookings)
 *    - Payment processing → Critical (prevents double charges)
 *    - Status changes → Critical (prevents inconsistent state)
 * 
 * 3. **Client Integration**:
 *    - Mobile apps should generate UUID per user action
 *    - Web forms should include hidden idempotency field
 *    - APIs should validate and cache responses appropriately
 * 
 * 4. **Error Handling**:
 *    - 400: Invalid idempotency key format
 *    - 409: Request processed with different result
 *    - 200: Request processed with same result (from cache)
 */