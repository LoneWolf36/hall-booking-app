import { api } from '@/lib/api';

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

export class AvailabilityService {
  /**
   * Check availability for a specific venue and time slot
   */
  static async checkAvailability(request: AvailabilityRequest): Promise<AvailabilityResponse> {
    try {
      // Format the datetime strings for the backend
      const startDateTime = `${request.date}T${request.startTime}:00.000Z`;
      const endDateTime = `${request.date}T${request.endTime}:00.000Z`;
      
      const response = await api.post(`/venues/${request.venueId}/availability`, {
        startTime: startDateTime,
        endTime: endDateTime,
      });
      
      return response.data;
    } catch (error) {
      console.error('Availability check failed:', error);
      throw new Error('Failed to check availability. Please try again.');
    }
  }

  /**
   * Get all available venues for browsing
   */
  static async getVenues() {
    try {
      const response = await api.get('/venues');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch venues:', error);
      throw new Error('Failed to load venues. Please try again.');
    }
  }

  /**
   * Get venue details by ID
   */
  static async getVenueById(venueId: string) {
    try {
      const response = await api.get(`/venues/${venueId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch venue details:', error);
      throw new Error('Failed to load venue details. Please try again.');
    }
  }

  /**
   * Format time for display
   */
  static formatTime(timeString: string): string {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Format date for display
   */
  static formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Validate time slot selection
   */
  static validateTimeSlot(startTime: string, endTime: string): {
    isValid: boolean;
    error?: string;
  } {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    
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
  }
}
