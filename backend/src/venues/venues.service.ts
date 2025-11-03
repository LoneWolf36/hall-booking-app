import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { format, isWeekend, isSunday } from 'date-fns';

export interface CalculatePricingDto {
  venueId: string;
  selectedDates: string[]; // Array of 'yyyy-MM-dd' date strings
  guestCount?: number;
  eventType?: string;
}

export interface PricingBreakdownDay {
  date: string;
  dayOfWeek: string;
  displayDate: string;
  basePrice: number;
  multiplier: number;
  finalPrice: number;
  appliedRates: string[];
}

export interface PricingCalculationResult {
  venueId: string;
  selectedDates: string[];
  breakdown: PricingBreakdownDay[];
  totalPrice: number;
  averagePricePerDay: number;
  savings?: number;
}

export interface VenuePricingConfig {
  weekendMultiplier?: number;
  sundayMultiplier?: number;
  seasonalRates?: Array<{
    name: string;
    startMonth: number;
    endMonth: number;
    multiplier: number;
  }>;
  surgeMultiplier?: number;
}

export interface FurnitureOption {
  id: string;
  name: string;
  description?: string;
  category: 'chairs' | 'tables' | 'stage' | 'other';
  baseQuantityIncluded: number;
  pricePerUnit: number;
  unitName: string;
  maxQuantity?: number;
}

export interface VenueContact {
  id: string;
  name: string;
  category: 'catering' | 'decoration' | 'photography' | 'entertainment' | 'florist' | 'other';
  phone: string;
  email?: string;
  website?: string;
  description?: string;
  rating?: number;
}

// Timeslot DTOs to match controller types
export type VenueTimeslotMode = 'full_day' | 'fixed_sessions' | 'custom';
export interface VenueSessionDto {
  id: string;
  label: string;
  start: string; // HH:mm
  end: string;   // HH:mm
  priceMultiplier?: number;
  active?: boolean;
}
export interface VenueTimeslotsDto {
  mode: VenueTimeslotMode;
  sessions: VenueSessionDto[];
}

@Injectable()
export class VenuesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get venue by ID
   */
  async getVenue(tenantId: string, venueId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId, tenantId },
    });

    if (!venue) {
      throw new NotFoundException(`Venue ${venueId} not found`);
    }

    return venue;
  }

  /**
   * List all venues for a tenant (or all if no tenantId provided)
   */
  async listVenues(tenantId: string | undefined, options?: { isActive?: boolean; limit?: number; offset?: number }) {
    const where: any = tenantId ? { tenantId } : {};
    
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const [venues, total] = await Promise.all([
      this.prisma.venue.findMany({
        where,
        take: options?.limit || 50,
        skip: options?.offset || 0,
        orderBy: { name: 'asc' },
      }),
      this.prisma.venue.count({ where }),
    ]);

    return { venues, total };
  }

  /**
   * FEATURE: Venue timeslots configuration stored in venue.settings.timeslots
   * Provides get and update helpers used by VenueTimeslotsController
   */
  async getVenueTimeslots(tenantId: string | undefined, venueId: string): Promise<VenueTimeslotsDto> {
    // For public access (no tenant), fetch venue by id only
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId, ...(tenantId ? { tenantId } : {}) } as any });
    if (!venue) throw new NotFoundException(`Venue ${venueId} not found`);

    const defaults: VenueTimeslotsDto = {
      mode: 'fixed_sessions',
      sessions: [
        { id: 'morning', label: 'Morning (8 AM - 2 PM)', start: '08:00', end: '14:00', priceMultiplier: 0.6, active: true },
        { id: 'evening', label: 'Evening (4 PM - 11 PM)', start: '16:00', end: '23:00', priceMultiplier: 0.7, active: true },
        { id: 'full_day', label: 'Full Day (24h)', start: '00:00', end: '23:59', priceMultiplier: 1.0, active: true },
      ],
    };

    const cfg = (venue as any).settings?.['timeslots'] as VenueTimeslotsDto | undefined;
    return cfg && cfg.mode && Array.isArray(cfg.sessions) ? cfg : defaults;
  }

  async updateVenueTimeslots(
    tenantId: string,
    venueId: string,
    dto: VenueTimeslotsDto,
  ): Promise<VenueTimeslotsDto> {
    // Validate input minimally
    if (!dto || !dto.mode || !Array.isArray(dto.sessions)) {
      throw new NotFoundException('Invalid timeslot configuration');
    }

    const venue = await this.getVenue(tenantId, venueId);

    const updatedSettings = {
      ...(venue.settings as any),
      timeslots: dto,
    };

    await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: { settings: updatedSettings },
    });

    return dto;
  }

  /**
   * FEATURE 1: Calculate pricing with variable rates
   */
  async calculatePricing(dto: CalculatePricingDto) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dto.venueId)) {
      throw new Error(`Invalid venue ID format: ${dto.venueId}`);
    }

    const venue = await this.prisma.venue.findUnique({ where: { id: dto.venueId } });
    if (!venue) throw new NotFoundException(`Venue ${dto.venueId} not found`);

    const basePrice = venue.basePriceCents;
    const pricingConfig: VenuePricingConfig = (venue as any).settings?.['pricing'] || {};

    const breakdown: PricingBreakdownDay[] = dto.selectedDates.map((dateStr) => {
      const date = new Date(dateStr);
      const dayOfWeek = format(date, 'EEEE');
      const displayDate = format(date, 'MMM d, yyyy');
      
      let multiplier = 1;
      const appliedRates: string[] = [];

      if (isWeekend(date) && pricingConfig.weekendMultiplier) {
        multiplier *= pricingConfig.weekendMultiplier;
        appliedRates.push(`Weekend ${pricingConfig.weekendMultiplier}x`);
      }

      if (isSunday(date) && pricingConfig.sundayMultiplier) {
        multiplier = pricingConfig.sundayMultiplier;
        appliedRates.length = 0;
        appliedRates.push(`Sunday ${pricingConfig.sundayMultiplier}x`);
      }

      if (pricingConfig.seasonalRates) {
        const month = date.getMonth() + 1;
        const seasonalRate = pricingConfig.seasonalRates.find((sr) => month >= sr.startMonth && month <= sr.endMonth);
        if (seasonalRate) {
          multiplier *= seasonalRate.multiplier;
          appliedRates.push(`${seasonalRate.name} ${seasonalRate.multiplier}x`);
        }
      }

      if (pricingConfig.surgeMultiplier) {
        multiplier *= pricingConfig.surgeMultiplier;
        appliedRates.push(`Surge ${pricingConfig.surgeMultiplier}x`);
      }

      const finalPrice = Math.round(basePrice * multiplier);

      return {
        date: dateStr,
        dayOfWeek,
        displayDate,
        basePrice: basePrice / 100,
        multiplier,
        finalPrice,
        appliedRates,
      };
    });

    const totalPrice = breakdown.reduce((sum, day) => sum + day.finalPrice, 0);
    const averagePricePerDay = totalPrice / breakdown.length;

    return {
      venueId: dto.venueId,
      selectedDates: dto.selectedDates,
      breakdown,
      totalPrice: totalPrice / 100,
      averagePricePerDay: averagePricePerDay / 100,
    };
  }

  async getFurnitureOptions(tenantId: string, venueId: string): Promise<FurnitureOption[]> {
    const venue = await this.getVenue(tenantId, venueId);
    return ((venue as any).settings?.['furniture'] || []) as FurnitureOption[];
  }

  async addFurnitureOption(
    tenantId: string,
    venueId: string,
    furniture: Omit<FurnitureOption, 'id'>
  ): Promise<FurnitureOption> {
    const venue = await this.getVenue(tenantId, venueId);
    const existing = (venue as any).settings?.['furniture'] || [];
    const newFurniture: FurnitureOption = { ...furniture, id: `furniture-${Date.now()}` };

    await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: { settings: { ...(venue.settings as any), furniture: [...existing, newFurniture] } },
    });

    return newFurniture;
  }

  async updateFurnitureOption(
    tenantId: string,
    venueId: string,
    furnitureId: string,
    updates: Partial<FurnitureOption>
  ): Promise<FurnitureOption> {
    const venue = await this.getVenue(tenantId, venueId);
    const existing = ((venue as any).settings?.['furniture'] || []) as FurnitureOption[];
    const index = existing.findIndex((f) => f.id === furnitureId);
    if (index === -1) throw new NotFoundException(`Furniture option ${furnitureId} not found`);

    const updated = [...existing];
    updated[index] = { ...updated[index], ...updates } as FurnitureOption;

    await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: { settings: { ...(venue.settings as any), furniture: updated } },
    });

    return updated[index];
  }

  async getVenueContacts(tenantId: string, venueId: string, category?: string) {
    const venue = await this.getVenue(tenantId, venueId);
    let contacts: VenueContact[] = ((venue as any).settings?.['contacts'] || []) as VenueContact[];
    if (category) contacts = contacts.filter((c) => c.category === category);
    return contacts;
  }

  async addVenueContact(tenantId: string, venueId: string, contact: Omit<VenueContact, 'id'>) {
    const venue = await this.getVenue(tenantId, venueId);
    const existing = (venue as any).settings?.['contacts'] || [];
    const newContact: VenueContact = { ...contact, id: `contact-${Date.now()}` };

    await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: { settings: { ...(venue.settings as any), contacts: [...existing, newContact] } },
    });

    return newContact;
  }

  async getVenuePricingConfig(tenantId: string, venueId: string) {
    const venue = await this.getVenue(tenantId, venueId);
    const pricingConfig: VenuePricingConfig = (venue as any).settings?.['pricing'] || {};
    const gstRate = (venue as any).settings?.['gstRate'] || 0.18;

    return { basePriceCents: venue.basePriceCents, currency: venue.currency, gstRate, ...pricingConfig };
  }

  async updateVenuePricingConfig(
    tenantId: string,
    venueId: string,
    pricingUpdates: Partial<VenuePricingConfig & { gstRate?: number }>
  ) {
    const venue = await this.getVenue(tenantId, venueId);

    const { gstRate, ...pricingConfig } = pricingUpdates;
    const updatedSettings = {
      ...(venue.settings as any),
      pricing: { ...(venue as any).settings?.['pricing'], ...pricingConfig },
      ...(gstRate !== undefined && { gstRate }),
    } as any;

    const updated = await this.prisma.venue.update({ where: { id: venueId, tenantId }, data: { settings: updatedSettings } });

    return { basePriceCents: updated.basePriceCents, currency: updated.currency, gstRate: updatedSettings.gstRate, ...updatedSettings.pricing };
  }
}
