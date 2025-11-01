import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BookingsService } from '../bookings.service';
import {
  CreateBookingDto,
  BookingTimeRangeDto,
} from '../dto/create-booking.dto';
import {
  CreateBookingResponseDto,
  AvailabilityResponseDto,
} from '../dto/booking-response.dto';
import {
  RequireIdempotency,
  OptionalIdempotency,
} from '../../common/decorators/idempotent.decorator';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/dto/auth-response.dto';

@ApiTags('Venues > Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
@Controller('venues/:venueId')
export class VenueBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('bookings')
  @RequireIdempotency()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create booking for a venue' })
  @ApiParam({ name: 'venueId', required: true, description: 'Venue UUID' })
  @ApiResponse({
    status: 201,
    description: 'Booking created',
    type: CreateBookingResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict with existing booking; alternatives returned',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async createVenueBooking(
    @CurrentUser() user: RequestUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateBookingDto,
  ): Promise<CreateBookingResponseDto> {
    if (!dto.venueId) dto.venueId = venueId;
    else if (dto.venueId !== venueId) {
      throw new BadRequestException('venueId in path and body must match');
    }
    return this.bookingsService.createBooking(user.tenantId, dto);
  }

  @Public()
  @Get('availability')
  @OptionalIdempotency()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check venue availability for a date range' })
  @ApiParam({ name: 'venueId', required: true })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'ISO date/time in UTC (e.g., 2025-12-25T00:00:00.000Z)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'ISO date/time in UTC (e.g., 2025-12-26T00:00:00.000Z)',
  })
  @ApiResponse({
    status: 200,
    description: 'Availability computed',
    type: AvailabilityResponseDto,
  })
  async getVenueAvailability(
    @Param('venueId') venueId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ success: boolean; data: AvailabilityResponseDto }> {
    if (!startDate || !endDate)
      throw new BadRequestException('startDate and endDate are required');

    const dto: BookingTimeRangeDto = {
      venueId,
      startTs: startDate,
      endTs: endDate,
    };
    // Use first tenant for public access - in production get from venue or allow null
    const data = await this.bookingsService.checkAvailability(undefined as any, dto);
    return { success: true, data };
  }
}
