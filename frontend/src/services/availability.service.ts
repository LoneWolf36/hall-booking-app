import { api } from '../lib/api';
import type { AxiosResponse } from '../lib/api';

export interface AvailabilityRequest {
  venueId: string;
  startTime: string;
  endTime: string;
  date: string;
}

export interface AvailabilityResponse {
  available: boolean;
  conflicts: {
    id: string;
    startTime: string;
    endTime: string;
    bookingNumber: string;
  }[];
  suggestedSlots?: {
    startTime: string;
    endTime: string;
  }[];
  venue: {
    id: string;
    name: string;
    description: string;
    capacity: number;
    hourlyRate: number;
  };
}

export interface Venue {
  id: string;
  name: string;
  description: string;
  capacity: number;
  hourlyRate: number;
  amenities?: string[];
  images?: string[];
  location?: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export class AvailabilityService {
  /**
   * Check availability for a specific venue and time slot
   */
  static async checkAvailability(request: AvailabilityRequest): Promise<AvailabilityResponse> {
    try {
      // Format the datetime strings for the backend
      const startDateTime = `${request.date}T${request.startTime}:00.000Z`;
      const endDateTime = `${request.date}T${request.endTime}:00.000Z`;
      
      const response: AxiosResponse = await api.post(`/venues/${request.venueId}/availability`, {
        startTime: startDateTime,
        endTime: endDateTime,
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Availability check failed:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to check availability. Please try again.';
      throw new Error(errorMessage);
    }
  }

  /**
   * Get all available venues for browsing
   */
  static async getVenues(): Promise<Venue[]> {
    try {
      const response: AxiosResponse = await api.get('/venues');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch venues:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to load venues. Please try again.';
      throw new Error(errorMessage);
    }
  }

  /**
   * Get venue details by ID
   */
  static async getVenueById(venueId: string): Promise<Venue> {
    try {
      const response: AxiosResponse = await api.get(`/venues/${venueId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch venue details:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to load venue details. Please try again.';
      throw new Error(errorMessage);
    }
  }

  /**
   * Format time for display
   */
  static formatTime(timeString: string): string {
    try {
      return new Date(timeString).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (error) {
      console.warn('Failed to format time:', timeString);
      return timeString;
    }
  }

  /**
   * Format date for display
   */
  static formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      console.warn('Failed to format date:', dateString);
      return dateString;
    }
  }

  /**
   * Validate time slot selection
   */
  static validateTimeSlot(startTime: string, endTime: string): {
    isValid: boolean;
    error?: string;
  } {
    try {
      const start = new Date(`2000-01-01T${startTime}:00`);
      const end = new Date(`2000-01-01T${endTime}:00`);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          isValid: false,
          error: 'Invalid time format',
        };
      }
      
      if (start >= end) {
        return {
          isValid: false,
          error: 'End time must be after start time',
        };
      }
      
      const duration = (end.getTime() - start.getTime()) / (1000 * 60); // minutes
      
      if (duration < 30) {
        return {
          isValid: false,
          error: 'Minimum booking duration is 30 minutes',
        };
      }
      
      if (duration > 720) { // 12 hours
        return {
          isValid: false,
          error: 'Maximum booking duration is 12 hours',
        };
      }
      
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'Failed to validate time slot',
      };
    }
  }

  /**
   * Check if a date is in the past
   */
  static isDateInPast(dateString: string): boolean {
    try {
      const selectedDate = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      return selectedDate < today;
    } catch (error) {
      console.warn('Failed to validate date:', dateString);
      return false;
    }
  }
}