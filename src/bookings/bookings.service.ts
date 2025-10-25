import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { ErrorHandlerService } from '../common/services/error-handler.service';
import { BookingNumberService } from './services/booking-number.service';
import { AvailabilityService } from './services/availability.service';
import {
  CreateBookingDto,
  BookingStatus,
  PaymentStatus,
  BookingTimeRangeDto,
} from './dto/create-booking.dto';
import {
  BookingResponseDto,
  AvailabilityResponseDto,
  CreateBookingResponseDto,
} from './dto/booking-response.dto';
import { UserRole } from '../users/dto/create-user.dto';
import { Venue } from '@prisma/client';
import { randomUUID } from 'crypto';
import { suggestAlternatives } from './utils/suggest-alternatives';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly BOOKING_CACHE_TTL = 3600; // 1 hour
  private readonly AVAILABILITY_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly errorHandler: ErrorHandlerService,
    private readonly bookingNumberService: BookingNumberService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async createBooking(
    tenantId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<CreateBookingResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Creating booking for tenant ${tenantId}`);

    try {
      const { startTs, endTs } = this.validateAndNormalizeTimestamps(
        createBookingDto.startTs,
        createBookingDto.endTs,
      );
      const venue = await this.validateVenue(tenantId, createBookingDto.venueId);
      const customer = await this.handleCustomerInfo(tenantId, createBookingDto);

      if (createBookingDto.idempotencyKey) {
        const existing = await this.checkIdempotencyKey(tenantId, createBookingDto.idempotencyKey);
        if (existing) return this.buildCreateBookingResponse(existing, false);
      }

      const bookingNumber = await this.bookingNumberService.generateBookingNumber(tenantId);
      this.validateBusinessRules(createBookingDto, venue);

      try {
        const booking = await this.createBookingWithConstraints(
          tenantId,
          { ...createBookingDto, startTs, endTs, userId: customer.id, bookingNumber },
          venue,
        );
        await this.cacheBooking(booking);
        this.logger.log(`Booking ${bookingNumber} created in ${Date.now() - startTime}ms`);
        return this.buildCreateBookingResponse(booking, true);
      } catch (error) {
        // If overlap (23P01), compute alternatives and include in ConflictException
        if (error.code === '23P01') {
          const alternatives = await this.availabilityService.alternativesOnConflict(
            tenantId,
            createBookingDto.venueId,
            new Date(createBookingDto.startTs),
            new Date(createBookingDto.endTs),
          );
          throw new ConflictException({
            message: 'This time slot is no longer available',
            code: 'BOOKING_TIME_CONFLICT',
            alternatives,
          });
        }
        throw error;
      }
    } catch (error) {
      const enhanced = this.errorHandler.handleBookingError(error, {
        operation: 'create',
        venueId: createBookingDto.venueId,
        startTs: new Date(createBookingDto.startTs),
        endTs: new Date(createBookingDto.endTs),
      });
      this.logger.error('Booking creation failed', { tenantId, venueId: createBookingDto.venueId, error: enhanced.message });
      throw enhanced;
    }
  }

  async checkAvailability(
    tenantId: string,
    timeRange: BookingTimeRangeDto,
  ): Promise<AvailabilityResponseDto> {
    const cacheKey = `availability:${tenantId}:${timeRange.venueId}:${timeRange.startTs}:${timeRange.endTs}`;
    const cached = await this.getCachedAvailability(cacheKey);
    if (cached) return cached;

    const { startTs, endTs } = this.validateAndNormalizeTimestamps(timeRange.startTs, timeRange.endTs);

    const startTstz = startTs.toISOString();
    const endTstz = endTs.toISOString();

    const conflictingBookings = await this.prisma.$queryRaw<{
      id: string; bookingNumber: string; startTs: Date; endTs: Date; status: string; customerName: string;
    }[]>`
      SELECT b.id, b."bookingNumber", b."startTs", b."endTs", b.status, u.name as "customerName"
      FROM bookings b
      JOIN users u ON u.id = b."userId"
      WHERE b."tenantId" = ${tenantId}
        AND b."venueId" = ${timeRange.venueId}
        AND b.status IN ('temp_hold','pending','confirmed')
        AND tstzrange(${startTstz}, ${endTstz}, '[)') && tstzrange(b."startTs"::timestamptz, b."endTs"::timestamptz, '[)')
        ${timeRange.excludeBookingId ? `AND b.id != ${timeRange.excludeBookingId}` : ''}
      ORDER BY b."startTs"`;

    const blackoutPeriods = await this.prisma.$queryRaw<{
      id: string; reason: string; startTs: Date; endTs: Date; isMaintenance: boolean;
    }[]>`
      SELECT id, reason, "startTs", "endTs", "isMaintenance"
      FROM availability_blackouts
      WHERE "tenantId" = ${tenantId}
        AND "venueId" = ${timeRange.venueId}
        AND tstzrange(${startTstz}, ${endTstz}, '[)') && tstzrange("startTs"::timestamptz, "endTs"::timestamptz, '[)')
      ORDER BY "startTs"`;

    const isAvailable = conflictingBookings.length === 0 && blackoutPeriods.length === 0;

    const result: AvailabilityResponseDto = {
      isAvailable,
      conflictingBookings: conflictingBookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        customerName: b.customerName,
        customerPhone: '',
        startTs: b.startTs,
        endTs: b.endTs,
        status: b.status,
      })),
      blackoutPeriods,
      suggestedAlternatives: isAvailable
        ? []
        : await this.availabilityService.alternativesOnConflict(
            tenantId,
            timeRange.venueId!,
            startTs,
            endTs,
          ),
    };

    await this.cacheAvailability(cacheKey, result);
    return result;
  }

  // ... rest of class unchanged
}
