/**
 * Application Constants - Centralized configuration values
 * 
 * This file consolidates all constants used across the application
 * to eliminate duplication and provide a single source of truth.
 */

// ========================================
// TIME AND TIMEZONE CONSTANTS
// ========================================

export const TIME_CONSTANTS = {
  INDIAN_TIMEZONE: 'Asia/Kolkata',
  MIN_LEAD_TIME_HOURS: 2,
  MIN_DURATION_HOURS: 1,
  MAX_DURATION_HOURS: 168, // 7 days
  TEMP_HOLD_DURATION_MINUTES: 15,
  CANCELLATION_LEAD_TIME_HOURS: 24,
} as const;

// ========================================
// CACHING CONSTANTS
// ========================================

export const CACHE_CONSTANTS = {
  BOOKING_TTL_SECONDS: 3600,      // 1 hour
  AVAILABILITY_TTL_SECONDS: 300,  // 5 minutes
  IDEMPOTENCY_TTL_SECONDS: 86400, // 24 hours
  SEQUENCE_TTL_SECONDS: 31536000, // 1 year
} as const;

// ========================================
// CACHE KEY PREFIXES
// ========================================

export const CACHE_PREFIXES = {
  BOOKING: 'booking',
  AVAILABILITY: 'availability',
  IDEMPOTENCY: 'idempotency',
  BOOKING_SEQUENCE: 'booking_sequence',
} as const;

// ========================================
// DATABASE CONSTRAINT CODES
// ========================================

export const DB_ERROR_CODES = {
  POSTGRESQL_EXCLUSION_VIOLATION: '23P01',
  POSTGRESQL_UNIQUE_VIOLATION: '23505',
  POSTGRESQL_FOREIGN_KEY_VIOLATION: '23503',
  POSTGRESQL_CHECK_VIOLATION: '23514',
  PRISMA_UNIQUE_VIOLATION: 'P2002',
  PRISMA_FOREIGN_KEY_VIOLATION: 'P2003',
} as const;

// ========================================
// BUSINESS RULES CONSTANTS
// ========================================

export const BUSINESS_CONSTANTS = {
  DEFAULT_VENUE_PREFIX: 'HBK', // Hall Booking default prefix
  BOOKING_NUMBER_SEQUENCE_LENGTH: 4, // Zero-padded sequence digits
  MAX_GUEST_COUNT_DEFAULT: 1000,
  MIN_BOOKING_AMOUNT_CENTS: 0,
} as const;

// ========================================
// DATE FORMAT CONSTANTS
// ========================================

export const DATE_FORMAT_CONSTANTS = {
  INDIAN_FORMAT_OPTIONS: {
    timeZone: TIME_CONSTANTS.INDIAN_TIMEZONE,
    year: 'numeric' as const,
    month: 'short' as const,
    day: 'numeric' as const,
    hour: '2-digit' as const,
    minute: '2-digit' as const,
  },
  LOCALE: 'en-IN',
} as const;

// ========================================
// VALIDATION CONSTANTS
// ========================================

export const VALIDATION_CONSTANTS = {
  MAX_IDEMPOTENCY_KEY_LENGTH: 100,
  MAX_BOOKING_NUMBER_LENGTH: 50,
  MAX_CUSTOMER_NAME_LENGTH: 100,
  MAX_PHONE_NUMBER_LENGTH: 20,
  MAX_EMAIL_LENGTH: 255,
  MAX_SPECIAL_REQUESTS_LENGTH: 1000,
} as const;

// ========================================
// HTTP STATUS CODES (for reference)
// ========================================

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ========================================
// ERROR MESSAGE TEMPLATES
// ========================================

export const ERROR_MESSAGES = {
  BOOKING_CONFLICT: 'This time slot is no longer available',
  VENUE_NOT_FOUND: 'Venue not found',
  USER_NOT_FOUND: 'User not found',
  INVALID_DATE_FORMAT: 'Invalid date format provided',
  INVALID_TIME_RANGE: 'Start time must be before end time',
  INSUFFICIENT_LEAD_TIME: 'Insufficient lead time for booking',
  CAPACITY_EXCEEDED: 'Guest count exceeds venue capacity',
  BOOKING_TOO_SHORT: 'Booking duration too short',
  BOOKING_TOO_LONG: 'Booking duration too long',
} as const;

// ========================================
// TYPE HELPERS
// ========================================

export type TimeConstants = typeof TIME_CONSTANTS;
export type CacheConstants = typeof CACHE_CONSTANTS;
export type BusinessConstants = typeof BUSINESS_CONSTANTS;
export type ValidationConstants = typeof VALIDATION_CONSTANTS;