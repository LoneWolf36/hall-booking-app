import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VenueTimeslotsDto } from './venue-timeslots.controller';

@Injectable()
export class VenuesServiceExtended {
  constructor(private prisma: PrismaService) {}
  async getVenueTimeslots(tenantId: string, venueId: string): Promise<VenueTimeslotsDto> {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId, tenantId } });
    const ts = (venue?.settings as any)?.timeslots;
    return ts ?? { mode: 'full_day', sessions: [{ id: 'full_day', label: 'Full Day', start: '00:00', end: '23:59', priceMultiplier: 1, active: true }] };
  }
  async updateVenueTimeslots(tenantId: string, venueId: string, dto: VenueTimeslotsDto) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId, tenantId } });
    const updated = await this.prisma.venue.update({ where: { id: venueId, tenantId }, data: { settings: { ...(venue?.settings as any), timeslots: dto } } });
    return (updated.settings as any).timeslots;
  }
}
