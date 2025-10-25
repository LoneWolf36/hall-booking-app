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
 * Bookings Service - Core business logic for hall booking management
 * 
 * Key Features:
 * 1. Double-booking prevention using PostgreSQL exclusion constraints
 * 2. Sequential booking number generation
 * 3. Indian timezone (Asia/Kolkata) handling
 * 4. Customer upsert integration
 * 5. Constraint violation error handling
 * 6. Availability checking with conflict detection
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly INDIAN_TIMEZONE = 'Asia/Kolkata';

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Create new booking with double-booking prevention
   * 
   * Business Logic:
   * 1. Validate and normalize timestamps
   * 2. Create or update customer information
   * 3. Generate unique booking number
   * 4. Check availability and venue constraints
   * 5. Create booking with exclusion constraint protection
   * 6. Handle constraint violations gracefully
   * 
   * @param tenantId - Multi-tenant isolation
   * @param createBookingDto - Booking data
   * @returns Created booking with customer info
   */
  async createBooking(
    tenantId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<CreateBookingResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Creating booking for tenant ${tenantId}`);

    try {
      // 1. Validate input and normalize timestamps
      const { startTs, endTs } = this.validateAndNormalizeTimestamps(
        createBookingDto.startTs,
        createBookingDto.endTs,
      );

      // 2. Validate venue exists and get details
      const venue = await this.validateVenue(tenantId, createBookingDto.venueId);

      // 3. Handle customer creation/update
      const customer = await this.handleCustomerInfo(
        tenantId,
        createBookingDto,
      );

      // 4. Generate idempotency key if not provided
      const idempotencyKey =
        createBookingDto.idempotencyKey || this.generateIdempotencyKey();

      // 5. Check for existing booking with same idempotency key
      const existingBooking = await this.checkIdempotency(
        tenantId,
        idempotencyKey,
      );
      if (existingBooking) {
        this.logger.log('Returning existing booking for idempotency key');
        return this.buildCreateBookingResponse(existingBooking, false);
      }

      // 6. Generate sequential booking number
      const bookingNumber = await this.generateBookingNumber(tenantId);

      // 7. Validate guest count against venue capacity
      this.validateGuestCount(createBookingDto.guestCount, venue.capacity);

      // 8. Create booking with exclusion constraint protection
      const booking = await this.createBookingWithConstraints(
        tenantId,
        {
          ...createBookingDto,
          startTs,
          endTs,
          userId: customer.id,
          bookingNumber,
          idempotencyKey,
        },
        venue,
      );

      // 9. Cache booking for quick access
      await this.cacheBooking(booking);

      const duration = Date.now() - startTime;
      this.logger.log(`Booking created successfully in ${duration}ms`);

      return this.buildCreateBookingResponse(booking, true);
    } catch (error) {
      this.logger.error('Booking creation failed', error);
      throw this.handleBookingError(error);
    }
  }

  /**
   * Check availability for given time range
   * Uses exclusion constraints for accurate conflict detection
   */
  async checkAvailability(
    tenantId: string,
    timeRange: BookingTimeRangeDto,
  ): Promise<AvailabilityResponseDto> {
    const { startTs, endTs } = this.validateAndNormalizeTimestamps(
      timeRange.startTs,
      timeRange.endTs,
    );

    // Format timestamps for PostgreSQL tstzrange
    const startTstz = this.formatForTstzRange(startTs);
    const endTstz = this.formatForTstzRange(endTs);

    // Query for conflicting bookings using raw SQL for range operations
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
        AND b."venueId" = ${timeRange.venueId}
        AND b.status IN ('temp_hold', 'pending', 'confirmed')
        AND b.ts_range && tstzrange(${startTstz}, ${endTstz}, '[)')
        ${timeRange.excludeBookingId ? `AND b.id != ${timeRange.excludeBookingId}` : ''}
      ORDER BY b."startTs"
    `;

    // Query for blackout periods
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
        AND "venueId" = ${timeRange.venueId}
        AND ts_range && tstzrange(${startTstz}, ${endTstz}, '[)')
      ORDER BY "startTs"
    `;

    const isAvailable =
      conflictingBookings.length === 0 && blackoutPeriods.length === 0;

    // Generate alternative suggestions if not available
    const suggestedAlternatives = isAvailable
      ? []
      : await this.generateAlternativeSuggestions(
          tenantId,
          timeRange.venueId!,
          startTs,
          endTs,
        );

    return {
      isAvailable,
      conflictingBookings: conflictingBookings.map((booking) => ({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        customerName: booking.customerName,
        customerPhone: '', // Not exposed in availability check
        startTs: booking.startTs,
        endTs: booking.endTs,
        status: booking.status,
      })),
      blackoutPeriods,
      suggestedAlternatives,
    };
  }

  /**
   * Get booking by ID with full details
   */
  async getBookingById(
    tenantId: string,
    bookingId: string,
  ): Promise<BookingResponseDto | null> {
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

    return booking ? this.toBookingResponse(booking) : null;
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Validate and normalize timestamps for Indian timezone
   */
  private validateAndNormalizeTimestamps(
    startTsStr: string,
    endTsStr: string,
  ): { startTs: Date; endTs: Date } {
    const startTs = new Date(startTsStr);
    const endTs = new Date(endTsStr);

    // Validate dates are valid
    if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
      throw new BadRequestException('Invalid date format provided');
    }

    // Validate start is before end
    if (startTs >= endTs) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Validate start is in future (at least 1 hour from now)
    const now = new Date();
    const minStartTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    if (startTs < minStartTime) {
      throw new BadRequestException(
        'Booking must be at least 1 hour in the future',
      );
    }

    // Validate booking duration (minimum 1 hour, maximum 3 days)
    const durationHours = (endTs.getTime() - startTs.getTime()) / (1000 * 60 * 60);
    if (durationHours < 1) {
      throw new BadRequestException('Booking must be at least 1 hour long');
    }
    if (durationHours > 72) {
      throw new BadRequestException('Booking cannot exceed 3 days');
    }

    return { startTs, endTs };
  }

  /**
   * Format timestamp for PostgreSQL tstzrange
   * Ensures proper timezone handling
   */
  private formatForTstzRange(date: Date): string {
    // Format date for PostgreSQL tstzrange using native JS
    // This replaces moment-timezone dependency
    const utcDate = new Date(date.toISOString());
    
    // Add 5.5 hours for IST (Asia/Kolkata)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istDate = new Date(utcDate.getTime() + istOffset);
    
    return istDate.toISOString().replace('T', ' ').replace('Z', '+05:30');
  }

  /**
   * Validate venue exists and user has access
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
      throw new NotFoundException('Venue not found or inactive');
    }

    return venue;
  }

  /**
   * Handle customer creation or lookup
   */
  private async handleCustomerInfo(
    tenantId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<{ id: string; name: string; phone: string; email?: string }> {
    // If userId provided, verify it exists
    if (createBookingDto.userId) {
      const user = await this.usersService.findById(
        tenantId,
        createBookingDto.userId,
      );
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    }

    // If customer info provided, upsert the customer
    if (createBookingDto.customer) {
      return await this.usersService.upsertUserByPhone(tenantId, {
        name: createBookingDto.customer.name,
        phone: createBookingDto.customer.phone,
        email: createBookingDto.customer.email,
        role: UserRole.CUSTOMER,
      });
    }

    throw new BadRequestException(
      'Either userId or customer information must be provided',
    );
  }

  /**
   * Generate sequential booking number for tenant
   * Format: {TENANT_PREFIX}-{YEAR}-{SEQUENCE}
   * Example: PBH-2025-0001
   */
  private async generateBookingNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const cacheKey = `booking_sequence:${tenantId}:${year}`;

    // Use Redis for atomic counter
    const sequence = await this.redisService.incr(cacheKey);

    // Set expiry for next year
    if (sequence === 1) {
      const nextYear = new Date(`${year + 1}-01-01`);
      const ttl = Math.floor((nextYear.getTime() - Date.now()) / 1000);
      await this.redisService.set(cacheKey, sequence.toString(), ttl);
    }

    // Get tenant prefix (first 3 chars of tenant name or default)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const prefix = tenant?.name?.substring(0, 3).toUpperCase() || 'HBK';

    return `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Validate guest count against venue capacity
   */
  private validateGuestCount(
    guestCount: number | undefined,
    venueCapacity: number | null,
  ): void {
    if (!guestCount || !venueCapacity) return;

    if (guestCount > venueCapacity) {
      throw new BadRequestException(
        `Guest count (${guestCount}) exceeds venue capacity (${venueCapacity})`,
      );
    }
  }

  /**
   * Generate unique idempotency key
   */
  private generateIdempotencyKey(): string {
    return randomUUID();
  }

  /**
   * Check for existing booking with same idempotency key
   */
  private async checkIdempotency(
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
   * Create booking with exclusion constraint protection
   * This is where the magic happens - PostgreSQL prevents overlaps
   */
  private async createBookingWithConstraints(
    tenantId: string,
    bookingData: any,
    venue: Venue,
  ): Promise<any> {
    try {
      // Calculate pricing if not provided
      const totalAmountCents =
        bookingData.totalAmountCents ||
        this.calculateBookingPrice(
          bookingData.startTs,
          bookingData.endTs,
          venue.basePriceCents,
        );

      // Set hold expiry for temp bookings
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
    } catch (error: any) {
      // Handle exclusion constraint violation (double booking)
      if (error.code === '23P01') {
        // PostgreSQL exclusion constraint violation
        throw new ConflictException(
          'This time slot is no longer available. Please choose a different time.',
        );
      }
      throw error;
    }
  }

  /**
   * Calculate booking price based on duration and base rate
   */
  private calculateBookingPrice(
    startTs: Date,
    endTs: Date,
    basePriceCents: number,
  ): number {
    const durationHours = Math.ceil(
      (endTs.getTime() - startTs.getTime()) / (1000 * 60 * 60),
    );
    
    // Simple hourly pricing for now
    // Future: Add peak time multipliers, package deals, etc.
    return durationHours * basePriceCents;
  }

  /**
   * Cache booking for quick access
   */
  private async cacheBooking(booking: any): Promise<void> {
    const cacheKey = `booking:${booking.id}`;
    await this.redisService.set(
      cacheKey,
      JSON.stringify(booking),
      3600, // 1 hour TTL
    );
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
      booking.startTs.getTime() > now.getTime() + 24 * 60 * 60 * 1000; // 24h before

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
   * Build create booking response with additional context
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

  /**
   * Handle booking creation errors with proper error types
   */
  private handleBookingError(error: any): Error {
    if (error instanceof ConflictException) {
      return error;
    }
    
    if (error.code === '23P01') {
      return new ConflictException(
        'Time slot conflict detected. Please refresh and try again.',
      );
    }
    
    if (error.code === 'P2002') {
      return new ConflictException(
        'Booking with this idempotency key already exists.',
      );
    }
    
    return error;
  }

  /**
   * Generate alternative time suggestions when requested slot is unavailable
   */
  private async generateAlternativeSuggestions(
    tenantId: string,
    venueId: string,
    requestedStart: Date,
    requestedEnd: Date,
  ): Promise<{ startTs: Date; endTs: Date; isFullDay: boolean }[]> {
    // Implementation for suggesting alternative time slots
    // This is a complex algorithm that analyzes existing bookings
    // and suggests nearby available slots
    
    // For now, return empty array - this would be implemented
    // based on specific business requirements
    return [];
  }
}

/**
 * Service Design Highlights:
 * 
 * 1. **Exclusion Constraints**: PostgreSQL prevents double-bookings at database level
 * 2. **Sequential Booking Numbers**: Redis-based atomic counters
 * 3. **Timezone Safety**: Proper Indian timezone handling throughout
 * 4. **Error Handling**: Graceful constraint violation handling
 * 5. **Performance**: Efficient queries with proper indexing
 * 6. **Caching**: Redis integration for fast lookups
 * 7. **Business Rules**: Comprehensive validation and pricing
 */