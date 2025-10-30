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
   * List all venues for a tenant
   */
  async listVenues(tenantId: string, options?: { isActive?: boolean; limit?: number; offset?: number }) {
    const where = {
      tenantId,
      ...(options?.isActive !== undefined && { isActive: options.isActive }),
    };

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
   * FEATURE 1: Calculate pricing with variable rates
   * Supports weekend multiplier, Sunday multiplier, seasonal rates, surge pricing
   */
  async calculatePricing(dto: CalculatePricingDto): Promise<PricingCalculationResult> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: dto.venueId },
    });

    if (!venue) {
      throw new NotFoundException(`Venue ${dto.venueId} not found`);
    }

    const basePrice = venue.basePriceCents;
    
    // Parse pricing config from venue settings
    const pricingConfig: VenuePricingConfig = venue.settings?.['pricing'] || {};

    const breakdown: PricingBreakdownDay[] = dto.selectedDates.map((dateStr) => {
      const date = new Date(dateStr);
      const dayOfWeek = format(date, 'EEEE');
      const displayDate = format(date, 'MMM d, yyyy');
      
      let multiplier = 1;
      const appliedRates: string[] = [];

      // Apply weekend multiplier
      if (isWeekend(date) && pricingConfig.weekendMultiplier) {
        multiplier *= pricingConfig.weekendMultiplier;
        appliedRates.push(`Weekend ${pricingConfig.weekendMultiplier}x`);
      }

      // Apply Sunday multiplier (overrides weekend if higher)
      if (isSunday(date) && pricingConfig.sundayMultiplier) {
        multiplier = pricingConfig.sundayMultiplier;
        appliedRates.length = 0; // Clear weekend rate
        appliedRates.push(`Sunday ${pricingConfig.sundayMultiplier}x`);
      }

      // Apply seasonal rates
      if (pricingConfig.seasonalRates) {
        const month = date.getMonth() + 1; // 1-12
        const seasonalRate = pricingConfig.seasonalRates.find(
          (sr) => month >= sr.startMonth && month <= sr.endMonth
        );
        if (seasonalRate) {
          multiplier *= seasonalRate.multiplier;
          appliedRates.push(`${seasonalRate.name} ${seasonalRate.multiplier}x`);
        }
      }

      // Apply surge pricing
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

  /**
   * FEATURE 2: Get furniture options for a venue
   */
  async getFurnitureOptions(tenantId: string, venueId: string): Promise<FurnitureOption[]> {
    const venue = await this.getVenue(tenantId, venueId);
    
    // Furniture options stored in venue.settings.furniture
    const furniture: FurnitureOption[] = venue.settings?.['furniture'] || [];
    
    return furniture;
  }

  /**
   * FEATURE 2: Add furniture option to venue (admin)
   */
  async addFurnitureOption(
    tenantId: string,
    venueId: string,
    furniture: Omit<FurnitureOption, 'id'>
  ): Promise<FurnitureOption> {
    const venue = await this.getVenue(tenantId, venueId);
    
    const existingFurniture = venue.settings?.['furniture'] || [];
    const newFurniture: FurnitureOption = {
      ...furniture,
      id: `furniture-${Date.now()}`,
    };

    const updatedFurniture = [...existingFurniture, newFurniture];

    await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: {
        settings: {
          ...(venue.settings as any),
          furniture: updatedFurniture,
        },
      },
    });

    return newFurniture;
  }

  /**
   * FEATURE 2: Update furniture option
   */
  async updateFurnitureOption(
    tenantId: string,
    venueId: string,
    furnitureId: string,
    updates: Partial<FurnitureOption>
  ): Promise<FurnitureOption> {
    const venue = await this.getVenue(tenantId, venueId);
    
    const existingFurniture = venue.settings?.['furniture'] || [];
    const index = existingFurniture.findIndex((f: any) => f.id === furnitureId);

    if (index === -1) {
      throw new NotFoundException(`Furniture option ${furnitureId} not found`);
    }

    const updatedFurniture = [...existingFurniture];
    updatedFurniture[index] = { ...updatedFurniture[index], ...updates };

    await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: {
        settings: {
          ...(venue.settings as any),
          furniture: updatedFurniture,
        },
      },
    });

    return updatedFurniture[index];
  }

  /**
   * FEATURE 3: Get venue contacts (delegated services)
   */
  async getVenueContacts(tenantId: string, venueId: string, category?: string): Promise<VenueContact[]> {
    const venue = await this.getVenue(tenantId, venueId);
    
    // Contacts stored in venue.settings.contacts
    let contacts: VenueContact[] = venue.settings?.['contacts'] || [];

    if (category) {
      contacts = contacts.filter((c) => c.category === category);
    }

    return contacts;
  }

  /**
   * FEATURE 3: Add venue contact
   */
  async addVenueContact(
    tenantId: string,
    venueId: string,
    contact: Omit<VenueContact, 'id'>
  ): Promise<VenueContact> {
    const venue = await this.getVenue(tenantId, venueId);
    
    const existingContacts = venue.settings?.['contacts'] || [];
    const newContact: VenueContact = {
      ...contact,
      id: `contact-${Date.now()}`,
    };

    const updatedContacts = [...existingContacts, newContact];

    await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: {
        settings: {
          ...(venue.settings as any),
          contacts: updatedContacts,
        },
      },
    });

    return newContact;
  }

  /**
   * FEATURE 4: Get venue pricing configuration including GST
   */
  async getVenuePricingConfig(tenantId: string, venueId: string) {
    const venue = await this.getVenue(tenantId, venueId);

    const pricingConfig: VenuePricingConfig = venue.settings?.['pricing'] || {};
    const gstRate = venue.settings?.['gstRate'] || 0.18; // Default 18%

    return {
      basePriceCents: venue.basePriceCents,
      currency: venue.currency,
      gstRate,
      ...pricingConfig,
    };
  }

  /**
   * FEATURE 4: Update venue pricing configuration (admin)
   */
  async updateVenuePricingConfig(
    tenantId: string,
    venueId: string,
    pricingUpdates: Partial<VenuePricingConfig & { gstRate?: number }>
  ) {
    const venue = await this.getVenue(tenantId, venueId);

    const { gstRate, ...pricingConfig } = pricingUpdates;

    const updatedSettings = {
      ...(venue.settings as any),
      pricing: {
        ...(venue.settings?.['pricing'] || {}),
        ...pricingConfig,
      },
      ...(gstRate !== undefined && { gstRate }),
    };

    const updated = await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: { settings: updatedSettings },
    });

    return {
      basePriceCents: updated.basePriceCents,
      currency: updated.currency,
      gstRate: updatedSettings.gstRate,
      ...updatedSettings.pricing,
    };
  }
}
