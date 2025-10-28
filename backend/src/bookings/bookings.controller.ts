import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UseInterceptors,
  UseGuards,
  ClassSerializerInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
import {
  RequireIdempotency,
  OptionalIdempotency,
} from '../common/decorators/idempotent.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/dto/auth-response.dto';

/**
 * Bookings Controller - REST API endpoints for booking management
 * 
 * **Authentication**: All endpoints require JWT authentication
 */
@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /bookings - Create new booking
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireIdempotency()
  @ApiOperation({
    summary: 'Create new booking',
    description:
      'Creates a new hall booking with exclusion constraint protection. Requires idempotency key for safety.',
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
    @CurrentUser() user: RequestUser,
    @Body(ValidationPipe) createBookingDto: CreateBookingDto,
  ): Promise<CreateBookingResponseDto> {
    return await this.bookingsService.createBooking(user.tenantId, createBookingDto);
  }

  /**
   * GET /bookings/:id - Get booking by ID
   */
  @Get(':id')
  @OptionalIdempotency()
  @ApiOperation({
    summary: 'Get booking details by ID',
    description:
      'Retrieves full booking information including customer and venue details',
  })
  async getBookingById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; data: BookingResponseDto | null }> {
    const booking = await this.bookingsService.getBookingById(user.tenantId, id);
    return { success: true, data: booking };
  }

  /**
   * POST /bookings/check-availability - Check time slot availability
   */
  @Post('check-availability')
  @HttpCode(HttpStatus.OK)
  @OptionalIdempotency()
  @ApiOperation({
    summary: 'Check venue availability for time range',
    description:
      'Checks for conflicts and returns availability status with suggestions',
  })
  async checkAvailability(
    @CurrentUser() user: RequestUser,
    @Body(ValidationPipe) timeRangeDto: BookingTimeRangeDto,
  ): Promise<{ success: boolean; data: AvailabilityResponseDto }> {
    const availability = await this.bookingsService.checkAvailability(
      user.tenantId,
      timeRangeDto,
    );
    return { success: true, data: availability };
  }

  /**
   * POST /bookings/:id/confirm - Confirm pending booking
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequireIdempotency()
  @ApiOperation({
    summary: 'Confirm pending booking',
    description:
      'Transitions booking from pending to confirmed status. Usually triggered after payment.',
  })
  async confirmBooking(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() confirmData?: { confirmedBy?: string },
  ): Promise<{ success: boolean; data: BookingResponseDto; message: string }> {
    const booking = await this.bookingsService.confirmBooking(
      user.tenantId,
      id,
      confirmData?.confirmedBy,
    );

    return {
      success: true,
      data: booking,
      message: `Booking ${booking.bookingNumber} confirmed successfully`,
    };
  }

  /**
   * POST /bookings/:id/cancel - Cancel booking
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireIdempotency()
  @ApiOperation({
    summary: 'Cancel booking',
    description: 'Cancels booking and processes refund according to policy',
  })
  async cancelBooking(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelData: { reason?: string },
  ): Promise<{
    success: boolean;
    data: BookingResponseDto & {
      refundAmount: number;
      refundPercentage: number;
    };
    message: string;
  }> {
    const result = await this.bookingsService.cancelBooking(
      user.tenantId,
      id,
      cancelData?.reason,
    );

    return {
      success: true,
      data: result,
      message: `Booking cancelled. Refund: ${result.refundPercentage}% (₹${(result.refundAmount / 100).toFixed(2)})`,
    };
  }

  /**
   * GET /bookings/venue/:venueId/availability - Calendar view
   */
  @Get('venue/:venueId/availability')
  @ApiOperation({
    summary: 'Get venue availability calendar',
    description: 'Returns day-by-day availability for calendar views',
  })
  async getVenueAvailability(
    @CurrentUser() user: RequestUser,
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
    const date = dateStr ? new Date(dateStr) : new Date();
    const days = Math.min(parseInt(daysStr ?? '7', 10) || 7, 90);

    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const calendar = await this.bookingsService.getVenueAvailabilityCalendar(
      user.tenantId,
      venueId,
      date,
      days,
    );

    return { success: true, data: calendar };
  }

  /**
   * GET /bookings - List bookings with filters
   */
  @Get()
  @ApiOperation({
    summary: 'List bookings with filters',
    description: 'Returns paginated list of bookings with filtering options',
  })
  async listBookings(
    @CurrentUser() user: RequestUser,
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
    const filters: {
      status?: string;
      venueId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (status) filters.status = status;
    if (venueId) filters.venueId = venueId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const pagination = {
      page: parseInt(page ?? '1', 10) || 1,
      limit: Math.min(parseInt(limit ?? '20', 10) || 20, 100),
    };

    const result = await this.bookingsService.listBookings(
      user.tenantId,
      filters,
      pagination,
    );

    return {
      success: true,
      ...result,
    };
  }
}
