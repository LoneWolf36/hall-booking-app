import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Venue } from '../../../generated/prisma';

import {
  TIME_CONSTANTS,
  DATE_FORMAT_CONSTANTS,
  VALIDATION_CONSTANTS,
  ERROR_MESSAGES,
} from '../constants/app.constants';

/**
 * Centralized Validation Service - Uses centralized constants
 * 
 * Refactored to use constants from app.constants.ts instead of
 * hardcoded values throughout the service.
 */
@Injectable()
export class ValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Centralized timestamp validation using constants
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
        message: ERROR_MESSAGES.INVALID_DATE_FORMAT,
        details: 'Dates must be in ISO 8601 format (e.g., 2025-12-25T10:00:00.000Z)',
        code: 'INVALID_DATE_FORMAT'
      });
    }

    // Start must be before end
    if (startTs >= endTs) {
      throw new BadRequestException({
        message: ERROR_MESSAGES.INVALID_TIME_RANGE,
        details: 'Start time must be before end time',
        code: 'INVALID_TIME_RANGE'
      });
    }

    // Future booking validation using constants
    const now = new Date();
    const minStartTime = new Date(
      now.getTime() + TIME_CONSTANTS.MIN_LEAD_TIME_HOURS * 60 * 60 * 1000
    );

    if (startTs < minStartTime) {
      throw new BadRequestException({
        message: ERROR_MESSAGES.INSUFFICIENT_LEAD_TIME,
        details: `Bookings must be made at least ${TIME_CONSTANTS.MIN_LEAD_TIME_HOURS} hours in advance`,
        code: 'INSUFFICIENT_LEAD_TIME'
      });
    }

    // Duration validation using constants
    const durationHours = (endTs.getTime() - startTs.getTime()) / (1000 * 60 * 60);

    if (durationHours < TIME_CONSTANTS.MIN_DURATION_HOURS) {
      throw new BadRequestException({
        message: ERROR_MESSAGES.BOOKING_TOO_SHORT,
        details: `Minimum booking duration is ${TIME_CONSTANTS.MIN_DURATION_HOURS} hour(s)`,
        code: 'BOOKING_TOO_SHORT'
      });
    }

    if (durationHours > TIME_CONSTANTS.MAX_DURATION_HOURS) {
      throw new BadRequestException({
        message: ERROR_MESSAGES.BOOKING_TOO_LONG,
        details: `Maximum booking duration is ${TIME_CONSTANTS.MAX_DURATION_HOURS} hours (7 days)`,
        code: 'BOOKING_TOO_LONG'
      });
    }

    return { startTs, endTs };
  }

  /**
   * Centralized venue validation using constants
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
        message: ERROR_MESSAGES.VENUE_NOT_FOUND,
        details: 'The specified venue does not exist or is inactive',
        code: 'VENUE_NOT_FOUND'
      });
    }

    return venue;
  }

  /**
   * Centralized business rules validation using constants
   */
  validateBusinessRules(guestCount: number | undefined, venue: Venue): void {
    // Guest count validation
    if (guestCount && venue.capacity) {
      if (guestCount > venue.capacity) {
        throw new BadRequestException({
          message: ERROR_MESSAGES.CAPACITY_EXCEEDED,
          details: `Requested ${guestCount} guests, venue capacity is ${venue.capacity}`,
          code: 'CAPACITY_EXCEEDED'
        });
      }
    }

    // Additional business rules can be added here using constants
  }

  /**
   * Format date for tstzrange (PostgreSQL timestamp with timezone range)
   */
  formatForTstzRange(date: Date): string {
    return date.toISOString();
  }

  /**
   * Format date range using centralized constants
   */
  formatDateRange(startTs: Date, endTs: Date): string {
    const start = startTs.toLocaleDateString(
      DATE_FORMAT_CONSTANTS.LOCALE,
      DATE_FORMAT_CONSTANTS.INDIAN_FORMAT_OPTIONS
    );
    const end = endTs.toLocaleDateString(
      DATE_FORMAT_CONSTANTS.LOCALE,
      DATE_FORMAT_CONSTANTS.INDIAN_FORMAT_OPTIONS
    );
    
    return `${start} to ${end}`;
  }

  /**
   * Calculate booking duration in hours using constants
   */
  calculateDurationHours(startTs: Date, endTs: Date): number {
    return Math.ceil((endTs.getTime() - startTs.getTime()) / (1000 * 60 * 60));
  }

  /**
   * Validate string length using constants
   */
  validateStringLength(
    value: string | undefined,
    maxLength: number,
    fieldName: string
  ): void {
    if (value && value.length > maxLength) {
      throw new BadRequestException({
        message: `${fieldName} is too long`,
        details: `Maximum length is ${maxLength} characters`,
        code: 'FIELD_TOO_LONG'
      });
    }
  }

  /**
   * Validate customer name length
   */
  validateCustomerName(name: string): void {
    this.validateStringLength(
      name,
      VALIDATION_CONSTANTS.MAX_CUSTOMER_NAME_LENGTH,
      'Customer name'
    );
  }

  /**
   * Validate phone number length
   */
  validatePhoneNumber(phone: string): void {
    this.validateStringLength(
      phone,
      VALIDATION_CONSTANTS.MAX_PHONE_NUMBER_LENGTH,
      'Phone number'
    );
  }

  /**
   * Validate email length
   */
  validateEmail(email: string | undefined): void {
    if (email) {
      this.validateStringLength(
        email,
        VALIDATION_CONSTANTS.MAX_EMAIL_LENGTH,
        'Email address'
      );
    }
  }

  /**
   * Validate special requests length
   */
  validateSpecialRequests(specialRequests: string | undefined): void {
    this.validateStringLength(
      specialRequests,
      VALIDATION_CONSTANTS.MAX_SPECIAL_REQUESTS_LENGTH,
      'Special requests'
    );
  }
}