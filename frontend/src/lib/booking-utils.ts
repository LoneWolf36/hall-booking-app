/**
 * Booking Integration Utilities
 * 
 * Provides seamless integration between frontend timeslot system
 * and backend booking API that uses startTs/endTs timestamps.
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
 * Create booking with timeslot support
 * 
 * Automatically converts timeslot data to proper startTs/endTs for each date
 * and creates individual bookings or multi-day bookings as needed.
 */
export async function createTimeslotBooking(
  dto: TimeslotBookingDto,
  token?: string
) {
  const { selectedDates, timeSlot, venueId, ...otherData } = dto;
  
  // Generate idempotency key
  const idempotencyKey = `booking-${venueId}-${selectedDates.map(d => format(d, 'yyyyMMdd')).join('-')}-${timeSlot.id}-${Date.now()}`;
  
  // Sort dates for consistent processing
  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
  
  // For multi-day bookings, we need to determine if this is:
  // 1. Single continuous booking spanning multiple days
  // 2. Multiple separate single-day bookings
  
  const isConsecutiveDates = areConsecutiveDates(sortedDates);
  
  if (sortedDates.length === 1) {
    // Single day booking
    const date = sortedDates[0];
    const { startTs, endTs } = timeSlotToTimestamps(date, timeSlot);
    
    const bookingDto: CreateBookingDto = {
      ...otherData,
      venueId,
      startTs,
      endTs,
      selectedDates: [date],
      idempotencyKey,
    };
    
    console.log('Creating single-day booking:', {
      date: format(date, 'yyyy-MM-dd'),
      timeSlot: timeSlot.label,
      startTs: startTs.toISOString(),
      endTs: endTs.toISOString(),
    });
    
    return createBooking(bookingDto, token);
  } else if (isConsecutiveDates && timeSlot.id === 'full_day') {
    // Multi-day consecutive full-day booking (treat as single booking)
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    
    const { startTs } = timeSlotToTimestamps(firstDate, timeSlot);
    const { endTs } = timeSlotToTimestamps(lastDate, timeSlot);
    
    const bookingDto: CreateBookingDto = {
      ...otherData,
      venueId,
      startTs,
      endTs,
      selectedDates: sortedDates,
      idempotencyKey,
    };
    
    console.log('Creating multi-day consecutive booking:', {
      dateRange: `${format(firstDate, 'yyyy-MM-dd')} to ${format(lastDate, 'yyyy-MM-dd')}`,
      timeSlot: timeSlot.label,
      startTs: startTs.toISOString(),
      endTs: endTs.toISOString(),
      totalDays: sortedDates.length,
    });
    
    return createBooking(bookingDto, token);
  } else {
    // Multiple separate bookings (non-consecutive dates or partial-day timeslots)
    console.log('Creating multiple separate bookings:', {
      dates: sortedDates.map(d => format(d, 'yyyy-MM-dd')),
      timeSlot: timeSlot.label,
      reason: isConsecutiveDates ? 'partial-day timeslot' : 'non-consecutive dates',
    });
    
    const bookingPromises = sortedDates.map((date, index) => {
      const { startTs, endTs } = timeSlotToTimestamps(date, timeSlot);
      
      const bookingDto: CreateBookingDto = {
        ...otherData,
        venueId,
        startTs,
        endTs,
        selectedDates: [date],
        idempotencyKey: `${idempotencyKey}-${index}`,
      };
      
      return createBooking(bookingDto, token);
    });
    
    // Execute all bookings and return results
    const results = await Promise.allSettled(bookingPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value);
    const failed = results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason);
    
    if (failed.length > 0) {
      console.error('Some bookings failed:', failed);
      // If some bookings failed, we might want to cancel the successful ones
      // This is a business decision that should be handled appropriately
    }
    
    return {
      success: successful.length > 0,
      data: successful,
      errors: failed,
      message: `Created ${successful.length} bookings successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
    };
  }
}

/**
 * Check if dates are consecutive
 */
function areConsecutiveDates(dates: Date[]): boolean {
  if (dates.length <= 1) return true;
  
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currentDate = new Date(sortedDates[i]);
    
    // Check if dates are exactly one day apart
    prevDate.setDate(prevDate.getDate() + 1);
    
    if (prevDate.toDateString() !== currentDate.toDateString()) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate booking summary for display
 */
export function generateBookingSummary(dates: Date[], timeSlot: TimeSlot, venue: any) {
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const isConsecutive = areConsecutiveDates(sortedDates);
  const isMultiDay = sortedDates.length > 1;
  
  const summary = {
    dates: sortedDates,
    dateCount: sortedDates.length,
    timeSlot,
    venue,
    isConsecutive,
    isMultiDay,
    bookingType: getBookingType(sortedDates, timeSlot),
    displayRange: isMultiDay && isConsecutive 
      ? `${format(sortedDates[0], 'MMM d')} - ${format(sortedDates[sortedDates.length - 1], 'MMM d, yyyy')}`
      : sortedDates.map(d => format(d, 'MMM d, yyyy')).join(', '),
    timestamps: sortedDates.map(date => {
      const { startTs, endTs } = timeSlotToTimestamps(date, timeSlot);
      return {
        date: format(date, 'yyyy-MM-dd'),
        startTs: startTs.toISOString(),
        endTs: endTs.toISOString(),
      };
    }),
  };
  
  return summary;
}

/**
 * Determine booking type for backend processing
 */
function getBookingType(dates: Date[], timeSlot: TimeSlot): 'single-day' | 'multi-day-consecutive' | 'multi-day-separate' {
  if (dates.length === 1) {
    return 'single-day';
  }
  
  const isConsecutive = areConsecutiveDates(dates);
  
  if (isConsecutive && timeSlot.id === 'full_day') {
    return 'multi-day-consecutive';
  }
  
  return 'multi-day-separate';
}

/**
 * Validate timeslot booking data
 */
export function validateTimeslotBooking(dto: Partial<TimeslotBookingDto>): string[] {
  const errors: string[] = [];
  
  if (!dto.venueId) {
    errors.push('Venue is required');
  }
  
  if (!dto.selectedDates || dto.selectedDates.length === 0) {
    errors.push('At least one date must be selected');
  }
  
  if (!dto.timeSlot) {
    errors.push('Time slot is required');
  }
  
  if (!dto.eventType) {
    errors.push('Event type is required');
  }
  
  if (!dto.guestCount || dto.guestCount < 1) {
    errors.push('Guest count must be at least 1');
  }
  
  // Validate dates are not in the past
  if (dto.selectedDates) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pastDates = dto.selectedDates.filter(date => date < today);
    if (pastDates.length > 0) {
      errors.push('Cannot book dates in the past');
    }
  }
  
  return errors;
}