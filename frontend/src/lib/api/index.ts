/**
 * API Services Index
 * Centralized exports for all API services
 */

export * from './client';
export * as bookingsAPI from './bookings';
export * as paymentsAPI from './payments';
export * as venuesAPI from './venues';

// Convenience exports
export {
  createBooking,
  getBooking,
  checkAvailability,
  getVenueAvailability,
  confirmBooking,
  cancelBooking,
  listBookings,
  type BookingResponseDto,
  type CreateBookingDto,
  type AvailabilityResponseDto,
} from './bookings';

export {
  getPaymentOptions,
  selectPaymentMethod,
  createPaymentLink,
  recordCashPayment,
  getVenuePaymentConfig,
  getPaymentHistory,
  type PaymentOptionsResponseDto,
  type PaymentLinkResponseDto,
} from './payments';

export {
  listVenues,
  getVenue,
  getVenuePricing,
  calculatePricing,
  updateVenuePricing,
  getVenueContacts,
  getVenueFurnitureOptions,
  addFurnitureOption,
  updateFurnitureOption,
  type VenueDto,
  type VenuePricingDto,
  type PricingCalculationResult,
  type ContactDto,
  type FurnitureOptionDto,
} from './venues';
