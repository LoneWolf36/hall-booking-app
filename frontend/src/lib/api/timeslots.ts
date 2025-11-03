import { apiGet, apiPatch } from './client';

export type VenueTimeslotMode = 'full_day' | 'fixed_sessions' | 'custom';
export interface VenueSessionDto { id: string; label: string; start: string; end: string; priceMultiplier?: number; active?: boolean }
export interface VenueTimeslotsDto { mode: VenueTimeslotMode; sessions: VenueSessionDto[] }

export async function getVenueTimeslots(venueId: string) {
  return apiGet<{ success: boolean; data: VenueTimeslotsDto }>(`/venues/${venueId}/timeslots`);
}

export async function updateVenueTimeslots(venueId: string, dto: VenueTimeslotsDto, token?: string) {
  return apiPatch<{ success: boolean; data: VenueTimeslotsDto }>(`/venues/${venueId}/timeslots`, dto, token);
}
