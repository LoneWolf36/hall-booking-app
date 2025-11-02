/**
 * Holds API Service - backend paths fix
 * 
 * Adjusted endpoints to match backend routing (v1 prefix)
 */

import { apiCall } from './client';

export interface CreateHoldRequest {
  venueId: string;
  selectedDates: string[];
  duration?: number;
}

export interface Hold {
  id: string;
  venueId: string;
  userId: string;
  selectedDates: string[];
  expiresAt: string;
  createdAt: string;
  status: 'active' | 'expired' | 'released';
}

export interface HoldResponse {
  success: boolean;
  data?: Hold;
  message?: string;
  conflictDates?: string[];
}

const BASE = '/api/v1/bookings/holds';

export async function createHold(
  request: CreateHoldRequest,
  token?: string
): Promise<HoldResponse> {
  try {
    const response = await apiCall(
      BASE,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      token
    );
    return response;
  } catch (error) {
    console.error('Failed to create hold:', error);
    return { success: false, message: 'Failed to create temporary hold' };
  }
}

export async function refreshHold(
  holdId: string,
  token?: string
): Promise<HoldResponse> {
  try {
    const response = await apiCall(
      `${BASE}/${holdId}/refresh`,
      { method: 'PATCH' },
      token
    );
    return response;
  } catch (error) {
    console.error('Failed to refresh hold:', error);
    return { success: false, message: 'Failed to refresh hold' };
  }
}

export async function releaseHold(
  holdId: string,
  token?: string
): Promise<HoldResponse> {
  try {
    const response = await apiCall(
      `${BASE}/${holdId}`,
      { method: 'DELETE' },
      token
    );
    return response;
  } catch (error) {
    console.error('Failed to release hold:', error);
    return { success: false, message: 'Failed to release hold' };
  }
}

export async function getCurrentHold(
  token?: string
): Promise<HoldResponse> {
  try {
    const response = await apiCall(
      `${BASE}/current`,
      { method: 'GET' },
      token
    );
    return response;
  } catch (error) {
    console.error('Failed to get current hold:', error);
    return { success: false, message: 'Failed to get current hold' };
  }
}

export async function checkDateAvailability(
  venueId: string,
  dates: string[],
  token?: string
): Promise<{ success: boolean; availableDates?: string[]; conflictDates?: string[]; message?: string; }> {
  try {
    const response = await apiCall(
      '/api/v1/bookings/availability/check',
      {
        method: 'POST',
        body: JSON.stringify({ venueId, dates }),
      },
      token
    );
    return response;
  } catch (error) {
    console.error('Failed to check availability:', error);
    return { success: false, message: 'Failed to check availability' };
  }
}
