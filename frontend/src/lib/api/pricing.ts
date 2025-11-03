import { apiPost } from './client';

export async function calculatePricingWithSlot(payload: { venueId: string; selectedDates: string[]; slotId?: string; guestCount?: number; eventType?: string; }) {
  return apiPost('/venues/calculate-pricing', payload);
}
