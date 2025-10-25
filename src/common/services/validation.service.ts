import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Venue } from '@prisma/client';

/**
 * Centralized Validation Service - Unified validation logic
 * 
 * This service consolidates common validation patterns to eliminate
 * duplication across controllers and services.
 */
@Injectable()
export class ValidationService {
  private readonly INDIAN_TIMEZONE = 'Asia/Kolkata';
  private readonly MIN_LEAD_TIME_HOURS = 2;
  private readonly MIN_DURATION_HOURS = 1;
  private readonly MAX_DURATION_HOURS = 168; // 7 days

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Centralized timestamp validation with business rules
   */
  validateAndNormalizeTimestamps(
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
    const minStartTime = new Date(now.getTime() + this.MIN_LEAD_TIME_HOURS * 60 * 60 * 1000);

    if (startTs < minStartTime) {
      throw new BadRequestException({
        message: 'Insufficient lead time',
        details: `Bookings must be made at least ${this.MIN_LEAD_TIME_HOURS} hours in advance`,
        code: 'INSUFFICIENT_LEAD_TIME'
      });
    }

    // Duration validation
    const durationHours = (endTs.getTime() - startTs.getTime()) / (1000 * 60 * 60);

    if (durationHours < this.MIN_DURATION_HOURS) {
      throw new BadRequestException({
        message: 'Booking too short',
        details: `Minimum booking duration is ${this.MIN_DURATION_HOURS} hour(s)`,
        code: 'BOOKING_TOO_SHORT'
      });
    }

    if (durationHours > this.MAX_DURATION_HOURS) {
      throw new BadRequestException({
        message: 'Booking too long',
        details: `Maximum booking duration is ${this.MAX_DURATION_HOURS} hours (7 days)`,
        code: 'BOOKING_TOO_LONG'
      });
    }

    return { startTs, endTs };
  }

  /**
   * Centralized venue validation
   */
  async validateVenue(tenantId: string, venueId: string): Promise<Venue> {
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
   * Centralized business rules validation
   */
  validateBusinessRules(guestCount: number | undefined, venue: Venue): void {
    // Guest count validation
    if (guestCount && venue.capacity) {
      if (guestCount > venue.capacity) {
        throw new BadRequestException({
          message: 'Guest count exceeds venue capacity',
          details: `Requested ${guestCount} guests, venue capacity is ${venue.capacity}`,
          code: 'CAPACITY_EXCEEDED'
        });
      }
    }

    // Add more business rules as needed:
    // - Peak time restrictions
    // - Event type compatibility
    // - Minimum/maximum booking amounts
  }

  /**
   * Format date for tstzrange (PostgreSQL timestamp with timezone range)
   */
  formatForTstzRange(date: Date): string {
    return date.toISOString();
  }

  /**
   * Format date range for human-readable messages
   */
  formatDateRange(startTs: Date, endTs: Date): string {
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: this.INDIAN_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    const start = startTs.toLocaleDateString('en-IN', formatOptions);
    const end = endTs.toLocaleDateString('en-IN', formatOptions);
    
    return `${start} to ${end}`;
  }

  /**
   * Calculate booking duration in hours
   */
  calculateDurationHours(startTs: Date, endTs: Date): number {
    return Math.ceil((endTs.getTime() - startTs.getTime()) / (1000 * 60 * 60));
  }
}