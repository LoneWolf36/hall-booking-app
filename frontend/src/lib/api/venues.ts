/**
 * Venues API Service
 * Handles venue-related API calls including pricing
 */

import { apiGet, apiPost, apiPatch, ApiResponse } from './client';

export interface VenueDto {
  id: string;
  name: string;
  description?: string;
  city: string;
  capacity: number;
  basePriceCents: number;
  currency: string;
  isActive: boolean;
  imageUrl?: string;
  amenities?: string[];
  createdAt: Date;
}

export interface VenuePricingDto {
  venueId: string;
  basePriceCents: number;
  weekdayMultiplier: number;
  weekendMultiplier: number;
  seasonalRates?: Array<{
    name: string;
    startDate: string;
    endDate: string;
    multiplier: number;
    description?: string;
  }>;
  surgeRates?: Array<{
    name: string;
    condition: string;
    multiplier: number;
  }>;
}

export interface CalculatePricingDto {
  venueId: string;
  selectedDates: string[];
  guestCount?: number;
  eventType?: string;
}

export interface PricingCalculationResult {
  venueId: string;
  selectedDates: string[];
  breakdown: Array<{
    date: string;
    dayOfWeek: string;
    basePrice: number;
    multiplier: number;
    finalPrice: number;
    appliedRates: string[];
  }>;
  totalPrice: number;
  averagePricePerDay: number;
  savings?: number;
}

export interface ContactDto {
  id: string;
  name: string;
  category: 'catering' | 'decoration' | 'photography' | 'entertainment' | 'florist' | 'other';
  phone: string;
  email?: string;
  website?: string;
  description?: string;
  rating?: number;
}

export interface FurnitureOptionDto {
  id: string;
  name: string;
  description?: string;
  category: 'chairs' | 'tables' | 'stage' | 'other';
  baseQuantityIncluded: number;
  pricePerUnit: number;
  unitName: string; // e.g., "chair", "table"
  maxQuantity?: number;
}

/**
 * Get all venues
 */
export async function listVenues(options?: {
  city?: string;
  minCapacity?: number;
  maxCapacity?: number;
  page?: number;
  limit?: number;
}, token?: string) {
  const params = new URLSearchParams();
  if (options?.city) params.append('city', options.city);
  if (options?.minCapacity) params.append('minCapacity', options.minCapacity.toString());
  if (options?.maxCapacity) params.append('maxCapacity', options.maxCapacity.toString());
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  return apiGet<{
    data: VenueDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/venues?${params.toString()}`, token);
}

/**
 * Get venue by ID
 */
export async function getVenue(venueId: string, token?: string) {
  return apiGet<VenueDto>(`/venues/${venueId}`, token);
}

/**
 * Get venue pricing configuration
 */
export async function getVenuePricing(venueId: string, token?: string) {
  return apiGet<VenuePricingDto>(`/venues/${venueId}/pricing`, token);
}

/**
 * Calculate pricing for selected dates
 */
export async function calculatePricing(dto: CalculatePricingDto, token?: string) {
  return apiPost<PricingCalculationResult>(
    '/venues/calculate-pricing',
    dto,
    token
  );
}

/**
 * Update venue pricing (admin only)
 */
export async function updateVenuePricing(
  venueId: string,
  pricingData: Partial<VenuePricingDto>,
  token?: string
) {
  return apiPatch<VenuePricingDto>(
    `/venues/${venueId}/pricing`,
    pricingData,
    token
  );
}

/**
 * Get venue contacts (catering, decoration, etc.)
 */
export async function getVenueContacts(
  venueId: string,
  category?: string,
  token?: string
) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);

  return apiGet<ContactDto[]>(
    `/venues/${venueId}/contacts?${params.toString()}`,
    token
  );
}

/**
 * Get furniture options for venue
 */
export async function getVenueFurnitureOptions(
  venueId: string,
  token?: string
) {
  return apiGet<FurnitureOptionDto[]>(
    `/venues/${venueId}/furniture`,
    token
  );
}

/**
 * Add furniture option to venue
 */
export async function addFurnitureOption(
  venueId: string,
  furnitureData: Omit<FurnitureOptionDto, 'id'>,
  token?: string
) {
  return apiPost<FurnitureOptionDto>(
    `/venues/${venueId}/furniture`,
    furnitureData,
    token
  );
}

/**
 * Update furniture option
 */
export async function updateFurnitureOption(
  venueId: string,
  furnitureId: string,
  furnitureData: Partial<FurnitureOptionDto>,
  token?: string
) {
  return apiPatch<FurnitureOptionDto>(
    `/venues/${venueId}/furniture/${furnitureId}`,
    furnitureData,
    token
  );
}
