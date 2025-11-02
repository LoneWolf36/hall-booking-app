/**
 * Booking Integration Utilities - SIMPLIFIED VERSION
 * 
 * Removed all overengineering. Simple, predictable booking creation.
 * One booking per selected date. Clean and easy to understand.
 */

import { format } from 'date-fns';
import { timeSlotToTimestamps, type TimeSlot } from '@/components/booking/TimeSlotSelector';
import { createBooking, type CreateBookingDto } from './api/bookings';

export interface TimeslotBookingDto {
  venueId: string;
  selectedDates: Date[];
  timeSlot: TimeSlot;
  eventType: string;
  guestCount: number;
  specialRequests?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
}

/**
 * Create booking with timeslot support - SIMPLIFIED
 * 
 * Creates one booking per selected date. Simple, predictable, works every time.
 */
export async function createTimeslotBooking(
  dto: TimeslotBookingDto,
  token?: string
) {
  const { selectedDates, timeSlot, venueId, ...otherData } = dto;
  
  // Sort dates for consistent processing
  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
  
  if (sortedDates.length === 1) {
    // Single date booking - most common case
    return createSingleBooking(sortedDates[0], dto, token);
  } else {
    // Multiple dates - create separate bookings (simple and clear)
    return createMultipleBookings(sortedDates, dto, token);
  }
}

/**
 * Create single booking for one date
 */
async function createSingleBooking(
  date: Date,
  dto: TimeslotBookingDto,
  token?: string
) {
  const { timeSlot, venueId, ...otherData } = dto;
  const { startTs, endTs } = timeSlotToTimestamps(date, timeSlot);
  
  const idempotencyKey = `booking-${venueId}-${format(date, 'yyyyMMdd')}-${timeSlot.id}-${Date.now()}`;
  
  const bookingDto: CreateBookingDto = {
    ...otherData,
    venueId,
    startTs,
    endTs,
    selectedDates: [date],
    idempotencyKey,
  };
  
  return createBooking(bookingDto, token);
}

/**
 * Create multiple separate bookings (one per date)
 */
async function createMultipleBookings(
  dates: Date[],
  dto: TimeslotBookingDto,
  token?: string
) {
  const bookingPromises = dates.map((date, index) => {
    const { timeSlot, venueId, ...otherData } = dto;
    const { startTs, endTs } = timeSlotToTimestamps(date, timeSlot);
    
    const idempotencyKey = `booking-${venueId}-${format(date, 'yyyyMMdd')}-${timeSlot.id}-${Date.now()}-${index}`;
    
    const bookingDto: CreateBookingDto = {
      ...otherData,
      venueId,
      startTs,
      endTs,
      selectedDates: [date],
      idempotencyKey,
    };
    
    return createBooking(bookingDto, token);
  });
  
  // Execute all bookings
  const results = await Promise.allSettled(bookingPromises);
  
  const successful = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<any>).value);
    
  const failed = results
    .filter(r => r.status === 'rejected')
    .map(r => (r as PromiseRejectedResult).reason);
  
  return {
    success: successful.length > 0,
    data: successful,
    errors: failed,
    message: failed.length === 0 
      ? `Successfully created ${successful.length} bookings`
      : `${successful.length} bookings created, ${failed.length} failed`,
  };
}

/**
 * Simple booking validation - just the essentials
 */
export function validateTimeslotBooking(dto: Partial<TimeslotBookingDto>): string[] {
  const errors: string[] = [];
  
  if (!dto.venueId) errors.push('Please select a venue');
  if (!dto.selectedDates || dto.selectedDates.length === 0) errors.push('Please select at least one date');
  if (!dto.timeSlot) errors.push('Please select a time slot');
  if (!dto.eventType) errors.push('Please specify your event type');
  if (!dto.guestCount || dto.guestCount < 1) errors.push('Please enter guest count');
  
  return errors;
}

/**
 * Generate simple booking summary for display
 */
export function generateBookingSummary(dates: Date[], timeSlot: TimeSlot, venue: any) {
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  
  return {
    dates: sortedDates,
    dateCount: sortedDates.length,
    timeSlot,
    venue,
    displayText: sortedDates.length === 1 
      ? `${format(sortedDates[0], 'MMM d, yyyy')} • ${timeSlot.label}`
      : `${sortedDates.length} days • ${timeSlot.label}`,
    totalBookings: sortedDates.length, // One booking per date
  };
}