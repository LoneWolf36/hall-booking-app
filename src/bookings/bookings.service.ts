import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ErrorHandlerService } from '../common/services/error-handler.service';
import { CacheService } from '../common/services/cache.service';
import { ValidationService } from '../common/services/validation.service';
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

/**
 * Refactored Bookings Service - Eliminates redundant code
 * 
 * Key Improvements:
 * 1. Uses centralized CacheService for all caching operations
 * 2. Uses ValidationService for consistent validation logic
 * 3. Delegates availability checking to AvailabilityService
 * 4. Eliminates duplicate methods and code
 * 5. Maintains clean separation of concerns
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly BOOKING_CACHE_TTL = 3600; // 1 hour
  private readonly AVAILABILITY_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly errorHandler: ErrorHandlerService,
    private readonly cacheService: CacheService,
    private readonly validationService: ValidationService,
    private readonly bookingNumberService: BookingNumberService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /**
   * Create new booking - refactored to use centralized services
   */
  async createBooking(
    tenantId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<CreateBookingResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Creating booking for tenant ${tenantId}`);

    try {
      // 1. Validate and normalize timestamps using centralized validation
      const { startTs, endTs } = this.validationService.validateAndNormalizeTimestamps(
        createBookingDto.startTs,
        createBookingDto.endTs,
      );

      // 2. Validate venue using centralized validation
      const venue = await this.validationService.validateVenue(tenantId, createBookingDto.venueId);

      // 3. Handle customer upsert with validation
      const customer = await this.handleCustomerInfo(tenantId, createBookingDto);

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

      // 6. Validate business rules using centralized validation
      this.validationService.validateBusinessRules(createBookingDto.guestCount, venue);

      try {
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

        // 8. Cache booking using centralized caching
        await this.cacheService.cacheBooking(booking, this.BOOKING_CACHE_TTL);

        const duration = Date.now() - startTime;
        this.logger.log(`Booking ${bookingNumber} created successfully in ${duration}ms`);

        return this.buildCreateBookingResponse(booking, true);
      } catch (error) {
        // If overlap (23P01), compute alternatives using AvailabilityService
        if (error.code === '23P01') {
          const alternatives = await this.availabilityService.alternativesOnConflict(
            tenantId,
            createBookingDto.venueId,
            startTs,
            endTs,
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
   * Check availability - refactored to use centralized services
   */
  async checkAvailability(
    tenantId: string,
    timeRange: BookingTimeRangeDto,
  ): Promise<AvailabilityResponseDto> {
    // Check cache first using centralized caching
    const cached = await this.cacheService.getCachedAvailability(
      tenantId,
      timeRange.venueId!,
      timeRange.startTs,
      timeRange.endTs
    );
    if (cached) return cached;

    // Validate timestamps using centralized validation
    const { startTs, endTs } = this.validationService.validateAndNormalizeTimestamps(
      timeRange.startTs,
      timeRange.endTs
    );

    // Use AvailabilityService for availability checking
    const result = await this.availabilityService.checkAvailability(
      tenantId,
      timeRange.venueId!,
      startTs,
      endTs,
      timeRange.excludeBookingId
    );

    // Cache result using centralized caching
    await this.cacheService.cacheAvailability(
      tenantId,
      timeRange.venueId!,
      timeRange.startTs,
      timeRange.endTs,
      result,
      this.AVAILABILITY_CACHE_TTL
    );

    return result;
  }

  /**
   * Get booking by ID - refactored to use centralized caching
   */
  async getBookingById(
    tenantId: string,
    bookingId: string,
  ): Promise<BookingResponseDto | null> {
    // Check cache first using centralized caching
    const cached = await this.cacheService.getCachedBooking(bookingId);
    if (cached) return cached;

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
    await this.cacheService.cacheBooking(response, this.BOOKING_CACHE_TTL);

    return response;
  }

  // ========================================
  // PRIVATE METHODS (KEPT MINIMAL)
  // ========================================

  /**
   * Handle customer info - no changes needed
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
   * Check idempotency key - no changes needed
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
   * Create booking with constraints - simplified pricing calculation
   */
  private async createBookingWithConstraints(
    tenantId: string,
    bookingData: any,
    venue: Venue,
  ): Promise<any> {
    try {
      const totalAmountCents =
        bookingData.totalAmountCents ||
        this.calculateBookingPrice(bookingData.startTs, bookingData.endTs, venue.basePriceCents);

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
      throw error;
    }
  }

  /**
   * Calculate booking price - uses centralized validation for duration
   */
  private calculateBookingPrice(
    startTs: Date,
    endTs: Date,
    basePriceCents: number,
  ): number {
    const durationHours = this.validationService.calculateDurationHours(startTs, endTs);
    return durationHours * basePriceCents;
  }

  /**
   * Convert Prisma booking to response DTO - uses centralized validation
   */
  private toBookingResponse(booking: any): BookingResponseDto {
    const duration = this.validationService.calculateDurationHours(
      booking.startTs,
      booking.endTs
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
   * Build create booking response - no changes needed
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