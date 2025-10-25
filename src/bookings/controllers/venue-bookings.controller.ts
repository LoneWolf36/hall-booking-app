import { Controller, Post, Get, Body, Param, Query, Headers, HttpCode, HttpStatus, BadRequestException, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BookingsService } from '../bookings.service';
import { CreateBookingDto, BookingTimeRangeDto } from '../dto/create-booking.dto';
import { CreateBookingResponseDto, AvailabilityResponseDto } from '../dto/booking-response.dto';
import { RequireIdempotency, OptionalIdempotency } from '../../common/decorators/idempotent.decorator';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

@ApiTags('Venues > Bookings')
@UseInterceptors(LoggingInterceptor)
@Controller('api/v1/venues/:venueId')
export class VenueBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('bookings')
  @RequireIdempotency()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create booking for a venue' })
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @ApiParam({ name: 'venueId', required: true, description: 'Venue UUID' })
  @ApiResponse({ status: 201, description: 'Booking created', type: CreateBookingResponseDto })
  @ApiResponse({ status: 409, description: 'Conflict with existing booking; alternatives returned' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async createVenueBooking(
    @Headers('x-tenant-id') tenantId: string,
    @Param('venueId') venueId: string,
    @Body() dto: CreateBookingDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<CreateBookingResponseDto> {
    if (!tenantId) throw new BadRequestException('X-Tenant-Id header is required');
    // Ensure path param and body are aligned; body wins only if empty
    if (!dto.venueId) dto.venueId = venueId; else if (dto.venueId !== venueId) {
      throw new BadRequestException('venueId in path and body must match');
    }
    if (idempotencyKey && !dto.idempotencyKey) dto.idempotencyKey = idempotencyKey;
    return this.bookingsService.createBooking(tenantId, dto);
  }

  @Get('availability')
  @OptionalIdempotency()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check venue availability for a date range' })
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @ApiParam({ name: 'venueId', required: true })
  @ApiQuery({ name: 'startDate', required: true, description: 'ISO date/time in UTC (e.g., 2025-12-25T00:00:00.000Z)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'ISO date/time in UTC (e.g., 2025-12-26T00:00:00.000Z)' })
  @ApiResponse({ status: 200, description: 'Availability computed', type: AvailabilityResponseDto })
  async getVenueAvailability(
    @Headers('x-tenant-id') tenantId: string,
    @Param('venueId') venueId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ success: boolean; data: AvailabilityResponseDto }> {
    if (!tenantId) throw new BadRequestException('X-Tenant-Id header is required');
    if (!startDate || !endDate) throw new BadRequestException('startDate and endDate are required');

    const dto: BookingTimeRangeDto = { venueId, startTs: startDate, endTs: endDate };
    const data = await this.bookingsService.checkAvailability(tenantId, dto);
    return { success: true, data };
  }
}
