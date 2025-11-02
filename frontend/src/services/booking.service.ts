// CRIT-001: Frontend Booking Service - Complete API Integration
// This implements the core booking.service.ts with JWT authentication and error handling

import axios, { AxiosError } from 'axios';

// Types matching backend DTOs
export interface CreateBookingDto {
  venueId: string;
  customer?: {
    name: string;
    phone: string;
    email?: string;
  };
  userId?: string;
  startTs: string; // ISO timestamp
  endTs: string;   // ISO timestamp
  eventType?: string;
  guestCount?: number;
  specialRequests?: string;
  idempotencyKey?: string;
}

export interface BookingResponse {
  success: boolean;
  booking: {
    id: string;
    bookingNumber: string;
    status: 'temp_hold' | 'pending' | 'confirmed' | 'cancelled' | 'expired';
    totalAmountCents: number;
    currency: string;
    startTs: string;
    endTs: string;
    eventType?: string;
    guestCount?: number;
    specialRequests?: string;
    createdAt: string;
    holdExpiresAt?: string;
    paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
    venue: {
      id: string;
      name: string;
      capacity?: number;
      basePriceCents: number;
    };
    customer: {
      name: string;
      phone: string;
      email?: string;
    };
  };
  isNewCustomer?: boolean;
  holdExpiresIn?: number; // minutes
}

export interface AvailabilityResponse {
  isAvailable: boolean;
  conflictingBookings: Array<{
    id: string;
    bookingNumber: string;
    startTs: string;
    endTs: string;
    status: string;
    customerName: string;
  }>;
  blackoutPeriods: Array<{
    id: string;
    reason?: string;
    startTs: string;
    endTs: string;
    isMaintenance: boolean;
  }>;
  suggestedAlternatives?: Array<{
    startTs: string;
    endTs: string;
    score: number;
  }>;
}

export interface BookingListResponse {
  data: BookingResponse['booking'][];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// API Client Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

class BookingApiService {
  private getAuthHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async handleApiError(error: AxiosError): Promise<never> {
    if (error.response?.status === 401) {
      // Token expired - trigger auth flow
      localStorage.removeItem('auth_token');
      window.location.href = '/auth?redirect=' + encodeURIComponent(window.location.pathname);
      throw new Error('Authentication required');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied');
    }

    if (error.response?.status >= 400 && error.response?.status < 500) {
      const errorData = error.response.data as any;
      throw new Error(errorData?.message || 'Request failed');
    }

    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    throw new Error('Network error. Please check your connection.');
  }

  /**
   * Create a new booking
   * @param dto - Booking creation data
   * @param token - JWT authentication token
   * @returns Promise<BookingResponse>
   */
  async createBooking(dto: CreateBookingDto, token?: string): Promise<BookingResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/bookings`,
        dto,
        {
          headers: this.getAuthHeaders(token),
          timeout: 10000, // 10 second timeout
        }
      );
      
      return response.data;
    } catch (error) {
      await this.handleApiError(error as AxiosError);
    }
  }

  /**
   * Get booking details by ID
   * @param bookingId - Booking UUID
   * @param token - JWT authentication token  
   * @returns Promise<BookingResponse['booking'] | null>
   */
  async getBooking(bookingId: string, token?: string): Promise<BookingResponse['booking'] | null> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/bookings/${bookingId}`,
        {
          headers: this.getAuthHeaders(token),
          timeout: 5000,
        }
      );
      
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      await this.handleApiError(error as AxiosError);
    }
  }

  /**
   * Check venue availability for time range
   * @param venueId - Venue UUID
   * @param startTs - Start timestamp (ISO)
   * @param endTs - End timestamp (ISO)
   * @param token - JWT authentication token
   * @returns Promise<AvailabilityResponse>
   */
  async checkAvailability(
    venueId: string, 
    startTs: string, 
    endTs: string, 
    token?: string
  ): Promise<AvailabilityResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/bookings/availability`,
        { venueId, startTs, endTs },
        {
          headers: this.getAuthHeaders(token),
          timeout: 5000,
        }
      );
      
      return response.data;
    } catch (error) {
      await this.handleApiError(error as AxiosError);
    }
  }

  /**
   * Get venue availability calendar
   * @param venueId - Venue UUID
   * @param startDate - Start date for calendar
   * @param days - Number of days (max 90)
   * @param token - JWT authentication token
   * @returns Promise<Array of daily availability>
   */
  async getVenueCalendar(
    venueId: string,
    startDate: Date,
    days: number = 30,
    token?: string
  ) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/bookings/venue/${venueId}/calendar`,
        {
          params: {
            startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD
            days: Math.min(days, 90), // Enforce 90-day limit
          },
          headers: this.getAuthHeaders(token),
          timeout: 5000,
        }
      );
      
      return response.data;
    } catch (error) {
      await this.handleApiError(error as AxiosError);
    }
  }

  /**
   * List bookings with filtering and pagination
   * @param filters - Booking filters
   * @param pagination - Page and limit
   * @param token - JWT authentication token
   * @returns Promise<BookingListResponse>
   */
  async listBookings(
    filters: {
      status?: string;
      venueId?: string;
      startDate?: Date;
      endDate?: Date;
      userId?: string;
    } = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 20 },
    token?: string
  ): Promise<BookingListResponse> {
    try {
      const params = new URLSearchParams();
      
      // Add filters
      if (filters.status) params.append('status', filters.status);
      if (filters.venueId) params.append('venueId', filters.venueId);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      
      // Add pagination
      params.append('page', pagination.page.toString());
      params.append('limit', Math.min(pagination.limit, 100).toString()); // Max 100
      
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/bookings?${params.toString()}`,
        {
          headers: this.getAuthHeaders(token),
          timeout: 8000,
        }
      );
      
      return response.data;
    } catch (error) {
      await this.handleApiError(error as AxiosError);
    }
  }

  /**
   * Confirm a pending booking (admin only)
   * @param bookingId - Booking UUID
   * @param token - JWT authentication token
   * @returns Promise<BookingResponse['booking']>
   */
  async confirmBooking(bookingId: string, token?: string): Promise<BookingResponse['booking']> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/bookings/${bookingId}/confirm`,
        {},
        {
          headers: this.getAuthHeaders(token),
          timeout: 5000,
        }
      );
      
      return response.data;
    } catch (error) {
      await this.handleApiError(error as AxiosError);
    }
  }

  /**
   * Cancel a booking with refund calculation
   * @param bookingId - Booking UUID
   * @param reason - Cancellation reason
   * @param token - JWT authentication token
   * @returns Promise with refund details
   */
  async cancelBooking(
    bookingId: string, 
    reason?: string, 
    token?: string
  ): Promise<{
    booking: BookingResponse['booking'];
    refundPercentage: number;
    refundAmount: number;
  }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/bookings/${bookingId}/cancel`,
        { reason },
        {
          headers: this.getAuthHeaders(token),
          timeout: 5000,
        }
      );
      
      return response.data;
    } catch (error) {
      await this.handleApiError(error as AxiosError);
    }
  }

  /**
   * Generate idempotency key for booking creation
   * @returns string - Unique idempotency key
   */
  generateIdempotencyKey(): string {
    return `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const bookingService = new BookingApiService();
export default bookingService;

/**
 * Usage Examples:
 * 
 * // Create booking with authentication
 * const token = localStorage.getItem('auth_token');
 * const booking = await bookingService.createBooking({
 *   venueId: 'venue-123',
 *   customer: { name: 'John Doe', phone: '+919876543210' },
 *   startTs: '2025-12-25T04:30:00.000Z',
 *   endTs: '2025-12-25T20:30:00.000Z',
 *   idempotencyKey: bookingService.generateIdempotencyKey()
 * }, token);
 * 
 * // Check availability
 * const availability = await bookingService.checkAvailability(
 *   'venue-123',
 *   '2025-12-25T04:30:00.000Z', 
 *   '2025-12-25T20:30:00.000Z',
 *   token
 * );
 * 
 * // Get booking details
 * const booking = await bookingService.getBooking('booking-123', token);
 */