/**
 * Holds API Service
 * 
 * Manages temporary date holds during the booking process
 * - Creates holds when dates are selected
 * - Refreshes holds to prevent expiry
 * - Releases holds when cancelled or completed
 * - Handles hold conflicts and expiry
 */

import { apiCall } from './client';

export interface CreateHoldRequest {
  venueId: string;
  selectedDates: string[]; // YYYY-MM-DD format
  duration?: number; // minutes, default 30
}

export interface Hold {
  id: string;
  venueId: string;
  userId: string;
  selectedDates: string[];
  expiresAt: string; // ISO timestamp
  createdAt: string;
  status: 'active' | 'expired' | 'released';
}

export interface HoldResponse {
  success: boolean;
  data?: Hold;
  message?: string;
  conflictDates?: string[]; // Dates that are no longer available
}

/**
 * Create a temporary hold on selected dates
 * Returns hold ID and expiry time
 */
export async function createHold(
  request: CreateHoldRequest,
  token?: string
): Promise<HoldResponse> {
  try {
    const response = await apiCall(
      '/bookings/holds',
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      token
    );
    
    return response;
  } catch (error) {
    console.error('Failed to create hold:', error);
    return {
      success: false,
      message: 'Failed to create temporary hold',
    };
  }
}

/**
 * Refresh an existing hold to extend its expiry
 * Use this when user is active in the booking flow
 */
export async function refreshHold(
  holdId: string,
  token?: string
): Promise<HoldResponse> {
  try {
    const response = await apiCall(
      `/bookings/holds/${holdId}/refresh`,
      {
        method: 'PATCH',
      },
      token
    );
    
    return response;
  } catch (error) {
    console.error('Failed to refresh hold:', error);
    return {
      success: false,
      message: 'Failed to refresh hold',
    };
  }
}

/**
 * Release a hold (when user cancels or completes booking)
 */
export async function releaseHold(
  holdId: string,
  token?: string
): Promise<HoldResponse> {
  try {
    const response = await apiCall(
      `/bookings/holds/${holdId}`,
      {
        method: 'DELETE',
      },
      token
    );
    
    return response;
  } catch (error) {
    console.error('Failed to release hold:', error);
    return {
      success: false,
      message: 'Failed to release hold',
    };
  }
}

/**
 * Get current hold for user (if any)
 */
export async function getCurrentHold(
  token?: string
): Promise<HoldResponse> {
  try {
    const response = await apiCall(
      '/bookings/holds/current',
      {
        method: 'GET',
      },
      token
    );
    
    return response;
  } catch (error) {
    console.error('Failed to get current hold:', error);
    return {
      success: false,
      message: 'Failed to get current hold',
    };
  }
}

/**
 * Check if dates are still available (not held by others)
 */
export async function checkDateAvailability(
  venueId: string,
  dates: string[],
  token?: string
): Promise<{
  success: boolean;
  availableDates?: string[];
  conflictDates?: string[];
  message?: string;
}> {
  try {
    const response = await apiCall(
      '/bookings/availability/check',
      {
        method: 'POST',
        body: JSON.stringify({ venueId, dates }),
      },
      token
    );
    
    return response;
  } catch (error) {
    console.error('Failed to check availability:', error);
    return {
      success: false,
      message: 'Failed to check availability',
    };
  }
}