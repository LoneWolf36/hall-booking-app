/**
 * Enhanced Date Utility Functions
 * 
 * Comprehensive date formatting and display logic for booking system.
 * Handles single dates, consecutive ranges, and non-consecutive selections.
 */

import { format } from 'date-fns';

/**
 * Format a single date in consistent format
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
 * Format date range with intelligent consecutive/non-consecutive detection
 * Used in Event Details and Confirmation pages
 */
export function formatDateRange(dates: Date[], fallback = 'No date selected'): string {
  if (!dates || dates.length === 0) return fallback;

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

  // Format based on consecutiveness
  if (isConsecutive) {
    // Same month: "Nov 3-6, 2025" | Different months: "Nov 30 - Dec 3, 2025"
    if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
      return `${format(firstDate, 'MMM d')}-${format(lastDate, 'd, yyyy')} (${sorted.length} days)`;
    }
    return `${format(firstDate, 'MMM d')} - ${format(lastDate, 'MMM d, yyyy')} (${sorted.length} days)`;
  }
  
  return `${format(firstDate, 'MMM d')} - ${format(lastDate, 'MMM d, yyyy')} (${sorted.length} days, non-consecutive)`;
}

/**
 * Compact date range for cards and summaries
 * Used in booking summary cards and navigation
 */
export function formatDateRangeCompact(dates: Date[]): string {
  if (!dates || dates.length === 0) return '';
  
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  
  if (sorted.length === 1) {
    return format(sorted[0], 'MMM d, yyyy');
  }
  
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  // Check consecutiveness for compact display
  const isConsecutive = sorted.every((date, index) => {
    if (index === 0) return true;
    const prevDate = sorted[index - 1];
    const dayDiff = (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    return dayDiff === 1;
  });
  
  if (isConsecutive) {
    // Same month: "Nov 3-6" | Different months: "Nov 30 - Dec 3"
    if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
      return `${format(first, 'MMM d')}-${format(last, 'd, yyyy')}`;
    }
    return `${format(first, 'MMM d')} - ${format(last, 'MMM d, yyyy')}`;
  }
  
  return `${format(first, 'MMM d')}, ${format(last, 'MMM d, yyyy')} (+${sorted.length - 2} more)`;
}

/**
 * Get individual date list with weekdays
 * Used for detailed date displays with edit functionality
 */
export function getDateListWithWeekdays(dates: Date[]): Array<{
  date: Date;
  formatted: string;
  weekday: string;
  shortWeekday: string;
}> {
  if (!dates || dates.length === 0) return [];
  
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  
  return sorted.map(date => ({
    date,
    formatted: format(date, 'MMM d, yyyy'),
    weekday: format(date, 'EEEE'),
    shortWeekday: format(date, 'EEE'),
  }));
}

/**
 * Get days until a future date
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

/**
 * Check if an array of dates represents consecutive days
 */
export function areConsecutiveDates(dates: Date[]): boolean {
  if (dates.length <= 1) return true;
  
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  
  return sorted.every((date, index) => {
    if (index === 0) return true;
    const prevDate = sorted[index - 1];
    const dayDiff = (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    return dayDiff === 1;
  });
}

/**
 * Get date groups for better display (group consecutive dates)
 */
export function groupConsecutiveDates(dates: Date[]): Date[][] {
  if (dates.length === 0) return [];
  
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const groups: Date[][] = [];
  let currentGroup: Date[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const currentDate = sorted[i];
    const prevDate = sorted[i - 1];
    const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (dayDiff === 1) {
      // Consecutive - add to current group
      currentGroup.push(currentDate);
    } else {
      // Gap - start new group
      groups.push(currentGroup);
      currentGroup = [currentDate];
    }
  }
  
  // Add final group
  groups.push(currentGroup);
  return groups;
}