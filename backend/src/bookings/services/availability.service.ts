import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationService } from '../../common/services/validation.service';
import { suggestAlternatives } from '../utils/suggest-alternatives';
import { AvailabilityResponseDto } from '../dto/booking-response.dto';

/**
 * Enhanced Availability Service - Prevents double bookings using PostgreSQL exclusion constraints
 *
 * Core Functionality:
 * 1. Check venue availability for time ranges
 * 2. Detect conflicts with existing bookings
 * 3. Identify blackout periods (maintenance, venue closures)
 * 4. Suggest alternative time slots when conflicts exist
 *
 * **Double-Booking Prevention Strategy**:
 * - Database-level: PostgreSQL exclusion constraint on tstzrange
 * - Application-level: Pre-flight availability checks before booking
 * - Constraint name: 'no_booking_overlap' in schema
 *
 * **PostgreSQL Features Used**:
 * - tstzrange: Timestamp with timezone range type for precise intervals
 * - && operator: Overlap detection between time ranges
 * - Raw SQL: Prisma doesn't natively support tstzrange operations
 *
 * **Performance**:
 * - Results should be cached by CacheService (TTL: 5 minutes)
 * - Index on (tenantId, venueId, startTs, endTs) for fast lookups
 * - Raw queries use prepared statements for SQL injection safety
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * Perform comprehensive availability check for venue time slot.
   *
   * **Query Strategy**:
   * 1. Query conflicting bookings using tstzrange overlap detection
   * 2. Query blackout periods using same tstzrange logic
   * 3. If conflicts found, generate alternative time slot suggestions
   * 4. Return complete availability report
   *
   * **PostgreSQL tstzrange Overlap Logic**:
   * ```sql
   * tstzrange('2025-12-25 10:00:00+05:30', '2025-12-25 18:00:00+05:30', '[)')
   * &&
   * tstzrange(b."startTs"::timestamptz, b."endTs"::timestamptz, '[)')
   * ```
   * - '[)' means inclusive start, exclusive end (standard interval notation)
   * - && operator returns true if ranges overlap at all
   *
   * **Booking Status Filter**:
   * - Only considers temp_hold, pending, confirmed bookings
   * - Ignores cancelled and expired bookings
   * - Rationale: temp_hold bookings lock the slot for 15 minutes
   *
   * **Blackout Periods**:
   * - Maintenance windows set by venue staff
   * - Permanent unavailability periods
   * - One-time event closures
   *
   * @param tenantId - Tenant UUID for multi-tenant isolation
   * @param venueId - Venue UUID to check
   * @param startTs - Requested start timestamp (already validated)
   * @param endTs - Requested end timestamp (already validated)
   * @param excludeBookingId - Optional booking ID to exclude (for update scenarios)
   *
   * @returns AvailabilityResponseDto containing:
   *   - isAvailable: true if no conflicts or blackouts
   *   - conflictingBookings: Array of overlapping bookings with customer names
   *   - blackoutPeriods: Array of maintenance/closure periods
   *   - suggestedAlternatives: Array of nearby available slots (if unavailable)
   *
   * @example
   * ```typescript
   * const availability = await availabilityService.checkAvailability(
   *   tenantId,
   *   venueId,
   *   new Date('2025-12-25T10:00:00Z'),
   *   new Date('2025-12-25T18:00:00Z')
   * );
   * // Returns: { isAvailable: false, conflictingBookings: [...], suggestedAlternatives: [...] }
   * ```
   */
  async checkAvailability(
    tenantId: string,
    venueId: string,
    startTs: Date,
    endTs: Date,
    excludeBookingId?: string,
  ): Promise<AvailabilityResponseDto> {
    const startTstz = this.validationService.formatForTstzRange(startTs);
    const endTstz = this.validationService.formatForTstzRange(endTs);

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
      SELECT b.id, b."bookingNumber", b."startTs", b."endTs", b.status, u.name as "customerName"
      FROM bookings b
      JOIN users u ON u.id = b."userId"
      WHERE b."tenantId" = ${tenantId}
        AND b."venueId" = ${venueId}
        AND b.status IN ('temp_hold','pending','confirmed')
        AND tstzrange(${startTstz}, ${endTstz}, '[)') && tstzrange(b."startTs"::timestamptz, b."endTs"::timestamptz, '[)')
        ${excludeBookingId ? `AND b.id != ${excludeBookingId}` : ''}
      ORDER BY b."startTs"`;

    const blackoutPeriods = await this.prisma.$queryRaw<
      {
        id: string;
        reason: string;
        startTs: Date;
        endTs: Date;
        isMaintenance: boolean;
      }[]
    >`
      SELECT id, reason, "startTs", "endTs", "isMaintenance"
      FROM availability_blackouts
      WHERE "tenantId" = ${tenantId}
        AND "venueId" = ${venueId}
        AND tstzrange(${startTstz}, ${endTstz}, '[)') && tstzrange("startTs"::timestamptz, "endTs"::timestamptz, '[)')
      ORDER BY "startTs"`;

    const isAvailable =
      conflictingBookings.length === 0 && blackoutPeriods.length === 0;

    return {
      isAvailable,
      conflictingBookings: conflictingBookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        customerName: b.customerName,
        customerPhone: '', // Privacy: not exposed in availability check
        startTs: b.startTs,
        endTs: b.endTs,
        status: b.status,
      })),
      blackoutPeriods,
      suggestedAlternatives: isAvailable
        ? []
        : await this.alternativesOnConflict(tenantId, venueId, startTs, endTs),
    };
  }

  /**
   * Get conflicting bookings for time range (used internally and for alternatives).
   *
   * Queries bookings table for overlaps using Prisma's date comparison.
   * Simpler than tstzrange query but less precise (doesn't account for timezone edge cases).
   *
   * **Used By**:
   * - alternativesOnConflict() - to find free slots between conflicts
   * - Internal conflict detection when raw SQL not needed
   *
   * @param tenantId - Tenant UUID
   * @param venueId - Venue UUID
   * @param start - Start timestamp
   * @param end - End timestamp
   *
   * @returns Array of conflicting booking objects with id, startTs, endTs
   */
  async getConflicts(
    tenantId: string,
    venueId: string,
    start: Date,
    end: Date,
  ) {
    const conflicts = await this.prisma.booking.findMany({
      where: {
        tenantId,
        venueId,
        status: { in: ['temp_hold', 'pending', 'confirmed'] },
        AND: [{ startTs: { lt: end } }, { endTs: { gt: start } }],
      },
      select: { id: true, startTs: true, endTs: true },
      orderBy: { startTs: 'asc' },
    });
    return conflicts;
  }

  /**
   * Generate alternative time slot suggestions when requested slot is unavailable.
   *
   * **Algorithm**:
   * 1. Fetch all conflicts for requested time range
   * 2. If no conflicts, return empty array (should be available)
   * 3. Call suggestAlternatives() utility to find free slots
   * 4. Utility suggests slots before, after, or between conflicts
   *
   * **Suggestion Strategy**:
   * - Try same day before/after requested time
   * - Try next available day
   * - Limit to 3-5 suggestions to avoid overwhelming user
   * - Maintain same duration as original request
   *
   * Used by:
   * - createBooking() when PostgreSQL exclusion constraint throws 23P01
   * - checkAvailability() when conflicts detected
   *
   * @param tenantId - Tenant UUID
   * @param venueId - Venue UUID
   * @param requestedStart - Original requested start time
   * @param requestedEnd - Original requested end time
   *
   * @returns Array of suggested alternative time slots (max 5)
   *   Empty array if no conflicts (edge case) or no alternatives found
   */
  async alternativesOnConflict(
    tenantId: string,
    venueId: string,
    requestedStart: Date,
    requestedEnd: Date,
  ) {
    const conflicts = await this.getConflicts(
      tenantId,
      venueId,
      requestedStart,
      requestedEnd,
    );
    if (conflicts.length === 0) return [];
    return suggestAlternatives(requestedStart, requestedEnd, conflicts);
  }
}
