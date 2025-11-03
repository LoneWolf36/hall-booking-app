// Extend CalculatePricing DTO to include optional slotId
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { format, isWeekend, isSunday } from 'date-fns';

export interface CalculatePricingDto {
  venueId: string;
  selectedDates: string[];
  guestCount?: number;
  eventType?: string;
  slotId?: string; // NEW
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

@Injectable()
export class VenuesService {
  constructor(private prisma: PrismaService) {}

  async calculatePricing(dto: CalculatePricingDto) {
    const venue = await this.prisma.venue.findUnique({ where: { id: dto.venueId } });
    if (!venue) throw new NotFoundException(`Venue ${dto.venueId} not found`);

    const basePrice = venue.basePriceCents;
    const pricingConfig = (venue.settings as any)?.pricing || {};
    const timeslots = (venue.settings as any)?.timeslots || null;
    const slotMultiplier = (() => {
      if (!timeslots || !dto.slotId) return 1;
      const s = (timeslots.sessions || []).find((x: any) => x.id === dto.slotId && x.active !== false);
      return s?.priceMultiplier ? Number(s.priceMultiplier) : 1;
    })();

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
        const seasonal = pricingConfig.seasonalRates.find((sr: any) => month >= sr.startMonth && month <= sr.endMonth);
        if (seasonal) {
          multiplier *= seasonal.multiplier;
          appliedRates.push(`${seasonal.name} ${seasonal.multiplier}x`);
        }
      }
      if (pricingConfig.surgeMultiplier) {
        multiplier *= pricingConfig.surgeMultiplier;
        appliedRates.push(`Surge ${pricingConfig.surgeMultiplier}x`);
      }
      if (slotMultiplier !== 1) {
        multiplier *= slotMultiplier;
        appliedRates.push(`Session ${slotMultiplier}x`);
      }

      const finalPrice = Math.round(basePrice * multiplier);
      return { date: dateStr, dayOfWeek, displayDate, basePrice: basePrice / 100, multiplier, finalPrice, appliedRates };
    });

    const totalPrice = breakdown.reduce((sum, d) => sum + d.finalPrice, 0);
    const averagePricePerDay = totalPrice / breakdown.length;

    return { venueId: dto.venueId, selectedDates: dto.selectedDates, breakdown, totalPrice: totalPrice / 100, averagePricePerDay: averagePricePerDay / 100 };
  }
}
