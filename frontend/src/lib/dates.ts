/**
 * Date Utility Functions
 * 
 * Centralized date formatting to follow DRY principles and eliminate
 * code duplication across Event Details, Confirmation, and Success pages.
 */

import { format } from 'date-fns';

/**
 * Format a single date in a consistent format
 */
export function formatDate(date: Date): string {
  return format(date, 'MMM dd, yyyy');
}

/**
 * Format a date with full month name
 */
export function formatDateFull(date: Date): string {
  return format(date, 'MMMM d, yyyy');
}

/**
 * Format time in 12-hour format
 */
export function formatTime(date: Date): string {
  return format(date, 'h:mm a');
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date): string {
  return format(date, 'MMM dd, yyyy h:mm a');
}

/**
 * Format a date range display intelligently
 * Handles single dates, consecutive ranges, and non-consecutive selections
 * 
 * @param dates Array of selected dates
 * @param fallback Optional fallback text when dates array is empty
 * @returns Formatted date range string
 */
export function formatDateRange(dates: Date[], fallback = 'No date selected'): string {
  if (!dates || dates.length === 0) {
    return fallback;
  }

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const firstDate = sorted[0];
  const lastDate = sorted[sorted.length - 1];

  // Single date
  if (sorted.length === 1) {
    return format(firstDate, 'MMM dd, yyyy');
  }

  // Check if dates are consecutive
  const isConsecutive = sorted.every((date, index) => {
    if (index === 0) return true;
    const prevDate = sorted[index - 1];
    const dayDiff = (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    return dayDiff === 1;
  });

  // Format range based on consecutiveness
  if (isConsecutive) {
    return `${format(firstDate, 'MMM dd')} - ${format(lastDate, 'dd, yyyy')} (${sorted.length} days)`;
  }
  
  return `${format(firstDate, 'MMM dd')} - ${format(lastDate, 'dd, yyyy')} (${sorted.length} days, non-consecutive)`;
}

/**
 * Get days until a future date
 * Returns 0 for today, negative for past dates
 */
export function getDaysUntilDate(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
}

/**
 * Format date for API calls (YYYY-MM-DD)
 */
export function formatDateForAPI(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse API date string to Date object
 */
export function parseDateFromAPI(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Format date range for display in booking cards
 * Compact version for dashboard and lists
 */
export function formatDateRangeCompact(dates: Date[]): string {
  if (!dates || dates.length === 0) return '';
  
  if (dates.length === 1) {
    return format(dates[0], 'MMM d');
  }
  
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  return `${format(first, 'MMM d')} - ${format(last, 'MMM d')}`;
}

/**
 * Calculate booking duration in hours between start and end times
 */
export function calculateDuration(startTime: string, endTime: string): number | null {
  if (!startTime || !endTime) return null;
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const durationMinutes = endMinutes - startMinutes;
  
  return durationMinutes / 60;
}