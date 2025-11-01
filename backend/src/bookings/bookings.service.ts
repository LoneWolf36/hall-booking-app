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
   * Create a new booking for a venue with double-booking prevention.
   *
   * This is the core booking creation method that orchestrates:
   * - Timestamp validation and normalization (timezone-aware)
   * - Venue validation and business rule enforcement
   * - Customer lookup or creation (upsert by phone)
   * - Idempotency key checking to prevent duplicate bookings
   * - Atomic booking number generation with Redis/DB fallback
   * - PostgreSQL exclusion constraint protection against overlapping bookings
   * - Automatic cache invalidation and population
   *
   * **Side Effects**:
   * - Writes to `bookings` table in database
   * - May create new user in `users` table (if customer info provided)
   * - Updates Redis cache with booking data (TTL: 1 hour)
   * - Increments booking sequence counter in Redis
   *
   * **State Machine**:
   * - Creates booking in `temp_hold` status by default
   * - Sets `holdExpiresAt` to 15 minutes from creation
   * - Payment status initialized to `pending`
   *
   * @param tenantId - Tenant UUID for multi-tenant isolation
   * @param createBookingDto - Validated booking creation request containing:
   *   - startTs/endTs: ISO 8601 timestamps for booking window
   *   - venueId: UUID of the venue to book
   *   - userId OR customer: Either existing user ID or customer contact info
   *   - idempotencyKey: Optional key to prevent duplicate requests
   *   - eventType, guestCount, specialRequests: Optional booking metadata
   *
   * @returns CreateBookingResponseDto containing:
   *   - success: true
   *   - booking: Full booking details with customer and venue info
   *   - isNewCustomer: Whether a new customer record was created
   *   - paymentRequired: Whether payment is needed
   *   - holdExpiresIn: Minutes until temporary hold expires
   *   - nextSteps: Array of required actions (e.g., complete payment)
   *
   * @throws {BadRequestException} - Invalid input (dates, venue, customer info)
   * @throws {NotFoundException} - Venue not found or userId doesn't exist
   * @throws {ConflictException} - Time slot conflict with alternatives suggested
   * @throws {InternalServerErrorException} - Database or booking number generation failure
   *
   * @example
   * ```typescript
   * const booking = await bookingsService.createBooking(tenantId, {
   *   venueId: 'uuid-here',
   *   startTs: '2025-12-25T10:00:00.000Z',
   *   endTs: '2025-12-25T18:00:00.000Z',
   *   customer: { name: 'John', phone: '+919876543210' },
   *   idempotencyKey: 'unique-request-id',
   *   eventType: 'wedding',
   *   guestCount: 500
   * });
   * ```
   */
  async createBooking(
    tenantId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<CreateBookingResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Creating booking for tenant ${tenantId}`);

    try {
      // 1. Validate and normalize timestamps using centralized validation
      const { startTs, endTs } =
        this.validationService.validateAndNormalizeTimestamps(
          createBookingDto.startTs,
          createBookingDto.endTs,
        );

      // 2. Validate venue using centralized validation
      const venue = await this.validationService.validateVenue(
        tenantId,
        createBookingDto.venueId,
      );

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
      const bookingNumber =
        await this.bookingNumberService.generateBookingNumber(tenantId);

      // 6. Validate business rules using centralized validation
      this.validationService.validateBusinessRules(
        createBookingDto.guestCount,
        venue,
      );

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
        this.logger.log(
          `Booking ${bookingNumber} created successfully in ${duration}ms`,
        );

        return this.buildCreateBookingResponse(booking, true);
      } catch (error) {
        // If overlap (23P01), compute alternatives using AvailabilityService
        if (error.code === '23P01') {
          const alternatives =
            await this.availabilityService.alternativesOnConflict(
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
   * Check venue availability for a specific time range.
   *
   * Performs comprehensive availability check including:
   * - Conflicting bookings (temp_hold, pending, confirmed statuses)
   * - Blackout periods (maintenance or venue unavailability)
   * - Alternative time slot suggestions if unavailable
   *
   * **Caching Strategy**:
   * - Checks Redis cache first (TTL: 5 minutes)
   * - Caches results on miss to reduce database load
   * - Cache key pattern: `availability:{tenantId}:{venueId}:{startTs}:{endTs}`
   *
   * **Database Query**:
   * - Uses PostgreSQL tstzrange for precise timestamp overlap detection
   * - Queries both `bookings` and `availability_blackouts` tables
   * - Filters by tenant and venue for multi-tenant isolation
   *
   * @param tenantId - Tenant UUID for data isolation
   * @param timeRange - Time range query containing:
   *   - venueId: UUID of venue to check
   *   - startTs: Start timestamp (ISO 8601)
   *   - endTs: End timestamp (ISO 8601)
   *   - excludeBookingId: Optional booking ID to exclude (for updates)
   *
   * @returns AvailabilityResponseDto containing:
   *   - isAvailable: boolean indicating if slot is free
   *   - conflictingBookings: Array of overlapping bookings with customer names
   *   - blackoutPeriods: Array of maintenance/unavailable periods
   *   - suggestedAlternatives: Array of nearby available time slots
   *
   * @throws {BadRequestException} - Invalid timestamp format or range
   * @throws {NotFoundException} - Venue not found
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
      timeRange.endTs,
    );
    if (cached) return cached;

    // Validate timestamps using centralized validation
    const { startTs, endTs } =
      this.validationService.validateAndNormalizeTimestamps(
        timeRange.startTs,
        timeRange.endTs,
      );

    // Use AvailabilityService for availability checking
    const result = await this.availabilityService.checkAvailability(
      tenantId,
      timeRange.venueId!,
      startTs,
      endTs,
      timeRange.excludeBookingId,
    );

    // Cache result using centralized caching
    await this.cacheService.cacheAvailability(
      tenantId,
      timeRange.venueId!,
      timeRange.startTs,
      timeRange.endTs,
      result,
      this.AVAILABILITY_CACHE_TTL,
    );

    return result;
  }

  /**
   * Retrieve booking details by booking ID with tenant isolation.
   *
   * **Caching Behavior**:
   * - Attempts cache retrieval first (TTL: 1 hour)
   * - On cache miss, queries database and populates cache
   * - Cache key pattern: `booking:{bookingId}`
   *
   * **Included Relations**:
   * - user: Customer who made the booking
   * - venue: Venue details
   * - payments: All payment records (online and cash)
   *
   * @param tenantId - Tenant UUID for multi-tenant data isolation
   * @param bookingId - UUID of the booking to retrieve
   *
   * @returns BookingResponseDto with full booking details or null if not found.
   *   Includes computed fields:
   *   - duration: Booking length in hours
   *   - isActive: Whether booking is in active state
   *   - canBeCancelled: Whether cancellation is allowed (24h+ before event)
   *
   * @throws Never throws - returns null for not found
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

  /**
   * Confirm a pending booking and transition to confirmed status.
   *
   * **Allowed Transitions**:
   * - temp_hold → confirmed
   * - pending → confirmed
   *
   * **Side Effects**:
   * - Updates booking status to 'confirmed'
   * - Updates payment status to 'paid' if not already
   * - Sets confirmedAt timestamp
   * - Invalidates cache for this booking
   *
   * @param tenantId - Tenant UUID for multi-tenant isolation
   * @param bookingId - UUID of the booking to confirm
   * @param confirmedBy - Optional user ID who confirmed (for manual confirmations)
   *
   * @returns Updated booking with confirmed status
   *
   * @throws {NotFoundException} - Booking not found
   * @throws {BadRequestException} - Invalid state transition (e.g., already cancelled)
   */
  async confirmBooking(
    tenantId: string,
    bookingId: string,
    confirmedBy?: string,
  ): Promise<BookingResponseDto> {
    this.logger.log(`Confirming booking ${bookingId}`);

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: { user: true, venue: true },
    });

    if (!booking) {
      throw new NotFoundException({
        message: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    // Validate state transition
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Cannot confirm a cancelled booking',
        code: 'INVALID_STATE_TRANSITION',
      });
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      // Already confirmed - return current state (idempotent)
      return this.toBookingResponse(booking);
    }

    // Update booking to confirmed status
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        confirmedAt: new Date(),
        confirmedBy: confirmedBy || null,
        holdExpiresAt: null, // Clear hold expiration
      },
      include: { user: true, venue: true, payments: true },
    });

    // Invalidate cache
    await this.cacheService.invalidateBookingCache(bookingId);

    this.logger.log(`Booking ${booking.bookingNumber} confirmed`);

    const response = this.toBookingResponse(updatedBooking);
    await this.cacheService.cacheBooking(response, this.BOOKING_CACHE_TTL);

    return response;
  }

  /**
   * Cancel a booking and handle refund processing.
   *
   * **Cancellation Policy**:
   * - >72 hours before event: Full refund (100%)
   * - 24-72 hours: Partial refund (50%)
   * - <24 hours: No refund (0%)
   *
   * **Side Effects**:
   * - Updates booking status to 'cancelled'
   * - Records cancellation reason and timestamp
   * - Initiates refund processing (if applicable)
   * - Invalidates cache
   *
   * @param tenantId - Tenant UUID
   * @param bookingId - UUID of booking to cancel
   * @param reason - Optional cancellation reason
   *
   * @returns Updated booking with cancelled status and refund info
   *
   * @throws {NotFoundException} - Booking not found
   * @throws {BadRequestException} - Booking already cancelled or past event date
   */
  async cancelBooking(
    tenantId: string,
    bookingId: string,
    reason?: string,
  ): Promise<
    BookingResponseDto & { refundAmount: number; refundPercentage: number }
  > {
    this.logger.log(`Cancelling booking ${bookingId}`);

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: { user: true, venue: true, payments: true },
    });

    if (!booking) {
      throw new NotFoundException({
        message: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Booking is already cancelled',
        code: 'ALREADY_CANCELLED',
      });
    }

    // Check if event is in the past
    if (booking.endTs < new Date()) {
      throw new BadRequestException({
        message: 'Cannot cancel past bookings',
        code: 'EVENT_ALREADY_OCCURRED',
      });
    }

    // Calculate refund amount based on cancellation policy
    const hoursUntilEvent =
      (booking.startTs.getTime() - Date.now()) / (1000 * 60 * 60);
    let refundPercentage = 0;

    if (hoursUntilEvent > 72) {
      refundPercentage = 100; // Full refund
    } else if (hoursUntilEvent >= 24) {
      refundPercentage = 50; // Partial refund
    } else {
      refundPercentage = 0; // No refund
    }

    const refundAmount = Math.floor(
      ((booking.totalAmountCents ?? 0) * refundPercentage) / 100,
    );

    // Update booking to cancelled
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        meta: {
          ...((booking.meta as object) || {}),
          cancellation: {
            cancelledAt: new Date(),
            reason: reason || 'Customer request',
            refundPercentage,
            refundAmountCents: refundAmount,
          },
        },
      },
      include: { user: true, venue: true, payments: true },
    });

    // Invalidate cache
    await this.cacheService.invalidateBookingCache(bookingId);

    this.logger.log(
      `Booking ${booking.bookingNumber} cancelled. Refund: ${refundPercentage}%`,
    );

    const response = this.toBookingResponse(updatedBooking);
    await this.cacheService.cacheBooking(response, this.BOOKING_CACHE_TTL);

    return {
      ...response,
      refundAmount,
      refundPercentage,
    };
  }

  /**
   * Get venue availability calendar for date range.
   *
   * Returns day-by-day breakdown of bookings for calendar views.
   * Useful for admin dashboards and customer booking interfaces.
   *
   * @param tenantId - Tenant UUID
   * @param venueId - Venue UUID
   * @param startDate - Start date for calendar range
   * @param days - Number of days to include (max 90)
   *
   * @returns Array of daily availability with booking details
   */
  async getVenueAvailabilityCalendar(
    tenantId: string,
    venueId: string,
    startDate: Date,
    days: number = 30, // Default to 30 days for better UX
  ): Promise<
    Array<{
      date: string;
      isAvailable: boolean;
      bookings: Array<{
        id: string;
        bookingNumber: string;
        startTs: Date;
        endTs: Date;
        status: string;
        customerName: string;
      }>;
    }>
  > {
    // For public endpoint: validate venue exists (skip tenantId check if tenantId is empty)
    if (tenantId) {
      await this.validationService.validateVenue(tenantId, venueId);
    } else {
      // Public endpoint: just verify venue exists
      const venue = await this.prisma.venue.findUnique({
        where: { id: venueId },
      });
      if (!venue) {
        throw new NotFoundException(`Venue ${venueId} not found`);
      }
    }

    // Limit to 90 days maximum
    const limitedDays = Math.min(days, 90);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + limitedDays);

    // Fetch all bookings in date range
    const where: any = {
      venueId,
      startTs: { lte: endDate },
      endTs: { gte: startDate },
      status: {
        in: [
          BookingStatus.TEMP_HOLD,
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
        ],
      },
    };

    // If tenantId provided, filter by tenant (private endpoint)
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: { user: true },
      orderBy: { startTs: 'asc' },
    });

    // Group bookings by day
    const calendar: Array<{
      date: string;
      isAvailable: boolean;
      bookings: Array<{
        id: string;
        bookingNumber: string;
        startTs: Date;
        endTs: Date;
        status: string;
        customerName: string;
      }>;
    }> = [];

    for (let i = 0; i < limitedDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);

      // Use UTC to match database times (bookings are stored in UTC)
      const dayStart = new Date(Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate(),
        0, 0, 0, 0
      ));

      const dayEnd = new Date(Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate(),
        23, 59, 59, 999
      ));

      // Check if any bookings overlap with this day
      // A booking overlaps if: booking starts before day ends AND booking ends after day starts
      const dayBookings = bookings.filter((b) => {
        const bookingStart = new Date(b.startTs);
        const bookingEnd = new Date(b.endTs);
        // Booking occupies this day if it starts before midnight AND ends after start of day
        return bookingStart < dayEnd && bookingEnd > dayStart;
      });

      calendar.push({
        date: currentDate.toISOString().split('T')[0],
        isAvailable: dayBookings.length === 0,
        bookings: dayBookings.map((b) => ({
          id: b.id,
          bookingNumber: b.bookingNumber,
          startTs: b.startTs,
          endTs: b.endTs,
          status: b.status,
          // Hide customer name for privacy on public endpoint (empty string is falsy check)
          customerName: tenantId && tenantId.trim() ? b.user.name : 'Reserved',
        })),
      });
    }

    return calendar;
  }

  /**
   * List bookings with filtering and pagination.
   *
   * **Supported Filters**:
   * - status: Filter by booking status
   * - venueId: Filter by specific venue
   * - startDate/endDate: Filter by date range
   *
   * **Pagination**:
   * - page: Page number (1-indexed)
   * - limit: Items per page (max 100)
   *
   * @param tenantId - Tenant UUID
   * @param filters - Optional filters
   * @param pagination - Page and limit
   *
   * @returns Paginated booking list with metadata
   */
  async listBookings(
    tenantId: string,
    filters: {
      status?: string;
      venueId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination: { page: number; limit: number },
  ): Promise<{
    data: BookingResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.venueId) {
      where.venueId = filters.venueId;
    }

    if (filters.startDate || filters.endDate) {
      where.startTs = {};
      if (filters.startDate) {
        where.startTs.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.startTs.lte = filters.endDate;
      }
    }

    // Execute queries in parallel
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: { user: true, venue: true, payments: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings.map((b) => this.toBookingResponse(b)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ========================================
  // PRIVATE METHODS (KEPT MINIMAL)
  // ========================================

  /**
   * Handle customer information lookup or creation (upsert pattern).
   *
   * Business Logic:
   * - If userId provided: lookup existing user (throws if not found)
   * - If customer info provided: upsert by phone number
   * - Phone-based upsert allows anonymous bookings with minimal info
   *
   * @param tenantId - Tenant UUID for user isolation
   * @param createBookingDto - Booking DTO containing userId OR customer info
   *
   * @returns User object with id, name, phone, optional email
   *
   * @throws {NotFoundException} - If userId specified but doesn't exist
   * @throws {BadRequestException} - If neither userId nor customer provided
   *
   * @private
   */
  private async handleCustomerInfo(
    tenantId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<{ id: string; name: string; phone: string; email?: string }> {
    if (createBookingDto.userId) {
      const user = await this.usersService.findById(
        tenantId,
        createBookingDto.userId,
      );
      if (!user) {
        throw new NotFoundException({
          message: 'User not found',
          details: 'The specified user does not exist in this tenant',
          code: 'USER_NOT_FOUND',
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
      code: 'MISSING_CUSTOMER_INFO',
    });
  }

  /**
   * Check if booking with idempotency key already exists.
   *
   * Prevents duplicate booking creation from retried requests.
   * Idempotency keys are required for booking creation endpoints.
   *
   * @param tenantId - Tenant UUID
   * @param idempotencyKey - Client-provided unique request identifier
   *
   * @returns Existing booking if found, null otherwise
   *
   * @private
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
   * Create booking record in database with PostgreSQL constraint protection.
   *
   * **Database Constraints**:
   * - Exclusion constraint on tstzrange prevents overlapping bookings
   * - Unique constraint on bookingNumber ensures no duplicates
   * - Unique constraint on idempotencyKey prevents duplicate requests
   *
   * **Automatic Calculations**:
   * - totalAmountCents: duration * venue.basePriceCents (if not provided)
   * - holdExpiresAt: current time + 15 minutes (for temp_hold status)
   *
   * @param tenantId - Tenant UUID
   * @param bookingData - Booking data with normalized timestamps and booking number
   * @param venue - Venue object for pricing calculation
   *
   * @returns Created booking with user and venue relations
   *
   * @throws {ConflictException} - PostgreSQL exclusion constraint violation (code 23P01)
   * @throws {Error} - Database errors propagated to caller for handling
   *
   * @private
   */
  private async createBookingWithConstraints(
    tenantId: string,
    bookingData: any,
    venue: any,
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
      throw error;
    }
  }

  /**
   * Calculate booking total price based on duration and venue base price.
   *
   * Formula: totalPrice = durationHours * basePriceCents
   * Duration is rounded up to nearest hour.
   *
   * @param startTs - Booking start timestamp
   * @param endTs - Booking end timestamp
   * @param basePriceCents - Venue hourly rate in smallest currency unit (paisa for INR)
   *
   * @returns Total booking price in cents/paisa
   *
   * @private
   */
  private calculateBookingPrice(
    startTs: Date,
    endTs: Date,
    basePriceCents: number,
  ): number {
    const durationHours = this.validationService.calculateDurationHours(
      startTs,
      endTs,
    );
    return durationHours * basePriceCents;
  }

  /**
   * Transform Prisma booking entity to client-facing response DTO.
   *
   * **Computed Fields**:
   * - duration: Calculated from startTs/endTs in hours (rounded up)
   * - isActive: True for temp_hold, pending, or confirmed status
   * - canBeCancelled: True if booking is >24 hours away and not cancelled
   *
   * @param booking - Raw Prisma booking with user and venue relations
   *
   * @returns BookingResponseDto formatted for API responses
   *
   * @private
   */
  private toBookingResponse(booking: any): BookingResponseDto {
    const duration = this.validationService.calculateDurationHours(
      booking.startTs,
      booking.endTs,
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
   * Build comprehensive response for booking creation including next steps.
   *
   * Constructs user-friendly response with:
   * - Full booking details
   * - Customer creation flag
   * - Payment requirement status
   * - Time remaining for temp hold
   * - Next action steps (e.g., "Complete payment within X minutes")
   *
   * @param booking - Created booking entity
   * @param isNewCustomer - Whether customer was created during booking
   *
   * @returns CreateBookingResponseDto with success=true and next steps
   *
   * @private
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
