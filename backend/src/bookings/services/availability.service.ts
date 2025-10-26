import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationService } from '../../common/services/validation.service';
import { suggestAlternatives } from '../utils/suggest-alternatives';
import {
  AvailabilityResponseDto,
} from '../dto/booking-response.dto';

/**
 * Enhanced Availability Service - Centralized availability checking
 * 
 * This service consolidates all availability checking logic to eliminate
 * duplication and provide consistent availability validation.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * Comprehensive availability check with conflicting bookings and blackouts
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

    const conflictingBookings = await this.prisma.$queryRaw<{
      id: string;
      bookingNumber: string;
      startTs: Date;
      endTs: Date;
      status: string;
      customerName: string;
    }[]>`
      SELECT b.id, b."bookingNumber", b."startTs", b."endTs", b.status, u.name as "customerName"
      FROM bookings b
      JOIN users u ON u.id = b."userId"
      WHERE b."tenantId" = ${tenantId}
        AND b."venueId" = ${venueId}
        AND b.status IN ('temp_hold','pending','confirmed')
        AND tstzrange(${startTstz}, ${endTstz}, '[)') && tstzrange(b."startTs"::timestamptz, b."endTs"::timestamptz, '[)')
        ${excludeBookingId ? `AND b.id != ${excludeBookingId}` : ''}
      ORDER BY b."startTs"`;

    const blackoutPeriods = await this.prisma.$queryRaw<{
      id: string;
      reason: string;
      startTs: Date;
      endTs: Date;
      isMaintenance: boolean;
    }[]>`
      SELECT id, reason, "startTs", "endTs", "isMaintenance"
      FROM availability_blackouts
      WHERE "tenantId" = ${tenantId}
        AND "venueId" = ${venueId}
        AND tstzrange(${startTstz}, ${endTstz}, '[)') && tstzrange("startTs"::timestamptz, "endTs"::timestamptz, '[)')
      ORDER BY "startTs"`;

    const isAvailable = conflictingBookings.length === 0 && blackoutPeriods.length === 0;

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
   * Get conflicting bookings for a time slot
   */
  async getConflicts(tenantId: string, venueId: string, start: Date, end: Date) {
    const conflicts = await this.prisma.booking.findMany({
      where: {
        tenantId,
        venueId,
        status: { in: ['temp_hold', 'pending', 'confirmed'] },
        AND: [
          { startTs: { lt: end } },
          { endTs: { gt: start } },
        ],
      },
      select: { id: true, startTs: true, endTs: true },
      orderBy: { startTs: 'asc' },
    });
    return conflicts;
  }

  /**
   * Get alternative time slots when there's a conflict
   */
  async alternativesOnConflict(
    tenantId: string,
    venueId: string,
    requestedStart: Date,
    requestedEnd: Date,
  ) {
    const conflicts = await this.getConflicts(tenantId, venueId, requestedStart, requestedEnd);
    if (conflicts.length === 0) return [];
    return suggestAlternatives(requestedStart, requestedEnd, conflicts);
  }
}