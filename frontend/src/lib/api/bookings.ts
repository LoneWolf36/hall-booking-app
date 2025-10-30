/**
 * Bookings API Service
 * Handles all booking-related API calls
 */

import { apiGet, apiPost, ApiResponse } from './client';

export interface BookingTimeRangeDto {
  venueId: string;
  startTs: Date | string;
  endTs: Date | string;
}

export interface CreateBookingDto {
  venueId: string;
  eventType: string;
  guestCount: number;
  specialRequests?: string;
  startTs: Date | string;
  endTs: Date | string;
  selectedDates: Date[] | string[];
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  idempotencyKey: string;
}

export interface BookingResponseDto {
  id: string;
  bookingNumber: string;
  venueId: string;
  userId: string;
  status: string;
  eventType: string;
  guestCount: number;
  specialRequests?: string;
  startTs: Date;
  endTs: Date;
  totalAmountCents: number;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailabilityResponseDto {
  venueId: string;
  isAvailable: boolean;
  conflicts: Array<{
    bookingId: string;
    startTs: Date;
    endTs: Date;
    customerName: string;
  }>;
  suggestions: Array<{
    startTs: Date;
    endTs: Date;
  }>;
}

export interface VenueAvailabilityCalendar {
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
}

/**
 * Create a new booking
 */
export async function createBooking(dto: CreateBookingDto, token?: string) {
  return apiPost<BookingResponseDto>('/bookings', dto, token);
}

/**
 * Get booking by ID
 */
export async function getBooking(bookingId: string, token?: string) {
  return apiGet<BookingResponseDto>(`/bookings/${bookingId}`, token);
}

/**
 * Check availability for date range
 */
export async function checkAvailability(dto: BookingTimeRangeDto, token?: string) {
  return apiPost<AvailabilityResponseDto>('/bookings/check-availability', dto, token);
}

/**
 * Get venue availability calendar
 */
export async function getVenueAvailability(
  venueId: string,
  date?: string,
  days?: number,
  token?: string
) {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (days) params.append('days', days.toString());

  return apiGet<VenueAvailabilityCalendar[]>(
    `/bookings/venue/${venueId}/availability?${params.toString()}`,
    token
  );
}

/**
 * Confirm booking (after payment)
 */
export async function confirmBooking(bookingId: string, confirmedBy?: string, token?: string) {
  return apiPost<BookingResponseDto>(
    `/bookings/${bookingId}/confirm`,
    confirmedBy ? { confirmedBy } : {},
    token
  );
}

/**
 * Cancel booking
 */
export async function cancelBooking(bookingId: string, reason?: string, token?: string) {
  return apiPost<any>(
    `/bookings/${bookingId}/cancel`,
    reason ? { reason } : {},
    token
  );
}

/**
 * List bookings with filters
 */
export async function listBookings(
  options?: {
    status?: string;
    venueId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
  token?: string
) {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.venueId) params.append('venueId', options.venueId);
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  return apiGet<{
    data: BookingResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/bookings?${params.toString()}`, token);
}
