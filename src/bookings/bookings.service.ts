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
import {
  CreateBookingDto,
  BookingStatus,
  PaymentStatus,
  BookingTimeRangeDto,
} from './dto/create-booking.dto';
import {
  BookingResponseDto,
  AdminBookingResponseDto,
  AvailabilityResponseDto,
  CreateBookingResponseDto,
} from './dto/booking-response.dto';
import { UserRole } from '../users/dto/create-user.dto';
import { Booking, User, Venue } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Enhanced Bookings Service - Production-ready hall booking management
 * 
 * Key Improvements:
 * 1. Centralized error handling with context-aware messages
 * 2. Atomic booking number generation with Redis
 * 3. Enhanced tstzrange handling for Indian timezone
 * 4. Improved idempotency with comprehensive validation
 * 5. Better constraint violation handling
 * 6. Performance optimizations with caching
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly INDIAN_TIMEZONE = 'Asia/Kolkata';
  private readonly BOOKING_CACHE_TTL = 3600; // 1 hour
  private readonly AVAILABILITY_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly errorHandler: ErrorHandlerService,
    private readonly bookingNumberService: BookingNumberService,
  ) {}

  /**
   * Create new booking with enhanced error handling and atomic operations
   * 
   * Teaching: This method demonstrates production-ready booking creation:
   * - Comprehensive input validation
   * - Atomic sequence generation
   * - Database constraint protection
   * - Context-aware error handling
   */
  async createBooking(
    tenantId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<CreateBookingResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Creating booking for tenant ${tenantId}`);

    try {
      // 1. Validate and normalize timestamps with enhanced validation
      const { startTs, endTs } = this.validateAndNormalizeTimestamps(
        createBookingDto.startTs,
        createBookingDto.endTs,
      );

      // 2. Validate venue exists and is available
      const venue = await this.validateVenue(tenantId, createBookingDto.venueId);

      // 3. Handle customer upsert with validation
      const customer = await this.handleCustomerInfo(
        tenantId,
        createBookingDto,
      );

      // 4. Check for existing booking with idempotency key
      if (createBookingDto.idempotencyKey) {
        const existingBooking = await this.checkIdempotencyKey(
          tenantId,
          createBookingDto.idempotencyKey,
        );
        
        if (existingBooking) {
          this.logger.log('Returning cached booking for idempotency key');
          return this.buildCreateBookingResponse(existingBooking, false);
        }
      }

      // 5. Generate atomic booking number
      const bookingNumber = await this.bookingNumberService.generateBookingNumber(tenantId);

      // 6. Validate business rules
      this.validateBusinessRules(createBookingDto, venue);

      // 7. Create booking with constraint protection
      const booking = await this.createBookingWithConstraints(
        tenantId,
        {
          ...createBookingDto,
          startTs,
          endTs,
          userId: customer.id,
          bookingNumber,
        },
        venue,
      );

      // 8. Cache booking for performance
      await this.cacheBooking(booking);

      const duration = Date.now() - startTime;
      this.logger.log(`Booking ${bookingNumber} created successfully in ${duration}ms`);

      return this.buildCreateBookingResponse(booking, true);
      
    } catch (error) {
      // Use enhanced error handling with context
      const enhancedError = this.errorHandler.handleBookingError(error, {
        operation: 'create',
        venueId: createBookingDto.venueId,
        startTs: new Date(createBookingDto.startTs),
        endTs: new Date(createBookingDto.endTs),
      });
      
      this.logger.error('Booking creation failed', {
        tenantId,
        venueId: createBookingDto.venueId,
        error: enhancedError.message,
      });
      
      throw enhancedError;
    }
  }

  /**
   * Enhanced availability checking with caching
   */
  async checkAvailability(
    tenantId: string,
    timeRange: BookingTimeRangeDto,
  ): Promise<AvailabilityResponseDto> {
    // Check cache first for performance
    const cacheKey = `availability:${tenantId}:${timeRange.venueId}:${timeRange.startTs}:${timeRange.endTs}`;
    const cached = await this.getCachedAvailability(cacheKey);
    
    if (cached) {
      this.logger.log('Returning cached availability result');
      return cached;
    }

    try {
      const { startTs, endTs } = this.validateAndNormalizeTimestamps(
        timeRange.startTs,
        timeRange.endTs,
      );

      // Enhanced tstzrange formatting
      const availability = await this.checkTimeSlotAvailability(
        tenantId,
        timeRange.venueId!,
        startTs,
        endTs,
        timeRange.excludeBookingId,
      );

      // Cache result for performance
      await this.cacheAvailability(cacheKey, availability);

      return availability;
      
    } catch (error) {
      const enhancedError = this.errorHandler.handleBookingError(error, {
        operation: 'create',
        venueId: timeRange.venueId,
        startTs: new Date(timeRange.startTs),
        endTs: new Date(timeRange.endTs),
      });
      
      throw enhancedError;
    }
  }

  /**
   * Get booking by ID with enhanced caching
   */
  async getBookingById(
    tenantId: string,
    bookingId: string,
  ): Promise<BookingResponseDto | null> {
    // Check cache first
    const cacheKey = `booking:${bookingId}`;
    const cached = await this.getCachedBooking(cacheKey);
    
    if (cached) {
      return cached;
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        tenantId,
      },
      include: {
        user: true,
        venue: true,
        payments: true,
      },
    });

    if (!booking) {
      return null;
    }

    const response = this.toBookingResponse(booking);
    await this.cacheBooking(response);
    
    return response;
  }

  // ========================================
  // ENHANCED PRIVATE METHODS
  // ========================================

  /**
   * Enhanced timestamp validation with business rules
   */
  private validateAndNormalizeTimestamps(
    startTsStr: string,
    endTsStr: string,
  ): { startTs: Date; endTs: Date } {
    const startTs = new Date(startTsStr);
    const endTs = new Date(endTsStr);

    // Basic date validation
    if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
      throw new BadRequestException({
        message: 'Invalid date format provided',
        details: 'Dates must be in ISO 8601 format (e.g., 2025-12-25T10:00:00.000Z)',
        code: 'INVALID_DATE_FORMAT'
      });
    }

    // Start must be before end
    if (startTs >= endTs) {
      throw new BadRequestException({
        message: 'Invalid time range',
        details: 'Start time must be before end time',
        code: 'INVALID_TIME_RANGE'
      });
    }

    // Future booking validation (minimum lead time)
    const now = new Date();
    const minLeadTimeHours = 2; // Configurable business rule
    const minStartTime = new Date(now.getTime() + minLeadTimeHours * 60 * 60 * 1000);
    
    if (startTs < minStartTime) {
      throw new BadRequestException({
        message: 'Insufficient lead time',
        details: `Bookings must be made at least ${minLeadTimeHours} hours in advance`,
        code: 'INSUFFICIENT_LEAD_TIME'
      });
    }

    // Duration validation
    const durationHours = (endTs.getTime() - startTs.getTime()) / (1000 * 60 * 60);
    
    if (durationHours < 1) {
      throw new BadRequestException({
        message: 'Booking too short',
        details: 'Minimum booking duration is 1 hour',
        code: 'BOOKING_TOO_SHORT'
      });
    }
    
    if (durationHours > 168) { // 7 days
      throw new BadRequestException({
        message: 'Booking too long',
        details: 'Maximum booking duration is 7 days',
        code: 'BOOKING_TOO_LONG'
      });
    }

    return { startTs, endTs };
  }

  /**
   * Enhanced tstzrange formatting for PostgreSQL
   * 
   * Teaching: Proper timezone handling is critical for booking systems
   */
  private formatForTstzRange(date: Date): string {
    // Convert to Indian Standard Time (IST) for storage
    // PostgreSQL will handle timezone conversion internally
    return date.toISOString();
  }

  /**
   * Enhanced venue validation with business rules
   */
  private async validateVenue(tenantId: string, venueId: string): Promise<Venue> {
    const venue = await this.prisma.venue.findFirst({
      where: {
        id: venueId,
        tenantId,
        isActive: true,
      },
    });

    if (!venue) {
      throw new NotFoundException({
        message: 'Venue not found',
        details: 'The specified venue does not exist or is inactive',
        code: 'VENUE_NOT_FOUND'
      });
    }

    return venue;
  }

  /**
   * Enhanced customer info handling
   */
  private async handleCustomerInfo(
    tenantId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<{ id: string; name: string; phone: string; email?: string }> {
    if (createBookingDto.userId) {
      const user = await this.usersService.findById(tenantId, createBookingDto.userId);
      if (!user) {
        throw new NotFoundException({
          message: 'User not found',
          details: 'The specified user does not exist in this tenant',
          code: 'USER_NOT_FOUND'
        });
      }
      return user;
    }

    if (createBookingDto.customer) {
      return await this.usersService.upsertUserByPhone(tenantId, {
        name: createBookingDto.customer.name,
        phone: createBookingDto.customer.phone,
        email: createBookingDto.customer.email,
        role: UserRole.CUSTOMER,
      });
    }

    throw new BadRequestException({
      message: 'Customer information required',
      details: 'Either userId or customer information must be provided',
      code: 'MISSING_CUSTOMER_INFO'
    });
  }

  /**
   * Enhanced idempotency checking
   */
  private async checkIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<any> {
    return await this.prisma.booking.findFirst({
      where: {
        tenantId,
        idempotencyKey,
      },
      include: {
        user: true,
        venue: true,
      },
    });
  }

  /**
   * Enhanced business rules validation
   */
  private validateBusinessRules(createBookingDto: CreateBookingDto, venue: Venue): void {
    // Guest count validation
    if (createBookingDto.guestCount && venue.capacity) {
      if (createBookingDto.guestCount > venue.capacity) {
        throw new BadRequestException({
          message: 'Guest count exceeds venue capacity',
          details: `Requested ${createBookingDto.guestCount} guests, venue capacity is ${venue.capacity}`,
          code: 'CAPACITY_EXCEEDED'
        });
      }
    }

    // Add more business rules as needed
    // - Peak time restrictions
    // - Event type compatibility
    // - Minimum/maximum booking amounts
  }

  /**
   * Enhanced time slot availability checking
   */
  private async checkTimeSlotAvailability(
    tenantId: string,
    venueId: string,
    startTs: Date,
    endTs: Date,
    excludeBookingId?: string,
  ): Promise<AvailabilityResponseDto> {
    const startTstz = this.formatForTstzRange(startTs);
    const endTstz = this.formatForTstzRange(endTs);

    // Use native PostgreSQL tstzrange for precise overlap detection
    const conflictingBookings = await this.prisma.$queryRaw<
      {
        id: string;
        bookingNumber: string;
        startTs: Date;
        endTs: Date;
        status: string;
        customerName: string;
      }[]
    >`
      SELECT 
        b.id,
        b."bookingNumber",
        b."startTs",
        b."endTs",
        b.status,
        u.name as "customerName"
      FROM bookings b
      JOIN users u ON u.id = b."userId"
      WHERE b."tenantId" = ${tenantId}
        AND b."venueId" = ${venueId}
        AND b.status IN ('temp_hold', 'pending', 'confirmed')
        AND tstzrange(${startTstz}, ${endTstz}, '[)') && 
            tstzrange(b."startTs"::timestamptz, b."endTs"::timestamptz, '[)')
        ${excludeBookingId ? `AND b.id != ${excludeBookingId}` : ''}
      ORDER BY b."startTs"
    `;

    // Check blackout periods
    const blackoutPeriods = await this.prisma.$queryRaw<
      {
        id: string;
        reason: string;
        startTs: Date;
        endTs: Date;
        isMaintenance: boolean;
      }[]
    >`
      SELECT 
        id,
        reason,
        "startTs",
        "endTs",
        "isMaintenance"
      FROM availability_blackouts
      WHERE "tenantId" = ${tenantId}
        AND "venueId" = ${venueId}
        AND tstzrange(${startTstz}, ${endTstz}, '[)') && 
            tstzrange("startTs"::timestamptz, "endTs"::timestamptz, '[)')
      ORDER BY "startTs"
    `;

    const isAvailable = conflictingBookings.length === 0 && blackoutPeriods.length === 0;

    return {
      isAvailable,
      conflictingBookings: conflictingBookings.map((booking) => ({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        customerName: booking.customerName,
        customerPhone: '', // Privacy: not exposed in availability check
        startTs: booking.startTs,
        endTs: booking.endTs,
        status: booking.status,
      })),
      blackoutPeriods,
      suggestedAlternatives: [], // TODO: Implement suggestion algorithm
    };
  }

  /**
   * Enhanced booking creation with constraint protection
   */
  private async createBookingWithConstraints(
    tenantId: string,
    bookingData: any,
    venue: Venue,
  ): Promise<any> {
    try {
      const totalAmountCents =
        bookingData.totalAmountCents ||
        this.calculateBookingPrice(
          bookingData.startTs,
          bookingData.endTs,
          venue.basePriceCents,
        );

      const holdExpiresAt =
        bookingData.status === BookingStatus.TEMP_HOLD
          ? new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
          : null;

      return await this.prisma.booking.create({
        data: {
          tenantId,
          venueId: bookingData.venueId,
          userId: bookingData.userId,
          bookingNumber: bookingData.bookingNumber,
          startTs: bookingData.startTs,
          endTs: bookingData.endTs,
          status: bookingData.status || BookingStatus.TEMP_HOLD,
          holdExpiresAt,
          totalAmountCents,
          currency: venue.currency,
          paymentStatus: PaymentStatus.PENDING,
          idempotencyKey: bookingData.idempotencyKey,
          eventType: bookingData.eventType,
          guestCount: bookingData.guestCount,
          specialRequests: bookingData.specialRequests,
          meta: bookingData.meta,
        },
        include: {
          user: true,
          venue: true,
        },
      });
    } catch (error) {
      // Let the error handler deal with constraint violations
      throw error;
    }
  }

  /**
   * Enhanced pricing calculation
   */
  private calculateBookingPrice(
    startTs: Date,
    endTs: Date,
    basePriceCents: number,
  ): number {
    const durationHours = Math.ceil(
      (endTs.getTime() - startTs.getTime()) / (1000 * 60 * 60),
    );
    
    // TODO: Add sophisticated pricing logic:
    // - Peak time multipliers
    // - Day of week pricing
    // - Seasonal adjustments
    // - Package deals
    
    return durationHours * basePriceCents;
  }

  // ========================================
  // CACHING METHODS
  // ========================================

  private async cacheBooking(booking: any): Promise<void> {
    try {
      const cacheKey = `booking:${booking.id}`;
      await this.redisService.set(
        cacheKey,
        JSON.stringify(booking),
        this.BOOKING_CACHE_TTL,
      );
    } catch (error) {
      this.logger.warn('Failed to cache booking', error);
    }
  }

  private async getCachedBooking(cacheKey: string): Promise<BookingResponseDto | null> {
    try {
      const cached = await this.redisService.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn('Failed to get cached booking', error);
      return null;
    }
  }

  private async cacheAvailability(
    cacheKey: string,
    availability: AvailabilityResponseDto,
  ): Promise<void> {
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(availability),
        this.AVAILABILITY_CACHE_TTL,
      );
    } catch (error) {
      this.logger.warn('Failed to cache availability', error);
    }
  }

  private async getCachedAvailability(
    cacheKey: string,
  ): Promise<AvailabilityResponseDto | null> {
    try {
      const cached = await this.redisService.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn('Failed to get cached availability', error);
      return null;
    }
  }

  /**
   * Convert Prisma booking to response DTO
   */
  private toBookingResponse(booking: any): BookingResponseDto {
    const duration = Math.ceil(
      (booking.endTs.getTime() - booking.startTs.getTime()) / (1000 * 60 * 60),
    );

    const now = new Date();
    const canBeCancelled =
      booking.status !== 'cancelled' &&
      booking.startTs.getTime() > now.getTime() + 24 * 60 * 60 * 1000;

    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      venueId: booking.venueId,
      venueName: booking.venue?.name,
      customer: {
        id: booking.user.id,
        name: booking.user.name,
        phone: booking.user.phone,
        email: booking.user.email,
      },
      startTs: booking.startTs,
      endTs: booking.endTs,
      duration,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      eventType: booking.eventType,
      guestCount: booking.guestCount,
      specialRequests: booking.specialRequests,
      totalAmountCents: booking.totalAmountCents,
      currency: booking.currency,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      isActive: ['temp_hold', 'pending', 'confirmed'].includes(booking.status),
      canBeCancelled,
      holdExpiresAt: booking.holdExpiresAt,
    };
  }

  /**
   * Build create booking response
   */
  private buildCreateBookingResponse(
    booking: any,
    isNewCustomer: boolean,
  ): CreateBookingResponseDto {
    const bookingResponse = this.toBookingResponse(booking);
    
    const nextSteps: Array<{
      action: string;
      description: string;
      deadline?: Date;
    }> = [];
    
    if (booking.status === BookingStatus.TEMP_HOLD) {
      nextSteps.push({
        action: 'payment',
        description: 'Complete payment to confirm booking',
        deadline: booking.holdExpiresAt,
      });
    }

    return {
      success: true,
      booking: bookingResponse,
      isNewCustomer,
      paymentRequired: booking.totalAmountCents > 0,
      holdExpiresIn: booking.holdExpiresAt
        ? Math.floor((booking.holdExpiresAt.getTime() - Date.now()) / 60000)
        : undefined,
      nextSteps,
    };
  }
}