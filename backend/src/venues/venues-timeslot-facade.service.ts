import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VenueTimeslotsDto } from './venue-timeslots.controller';

@Injectable()
export class VenuesTimeslotFacadeService {
  constructor(private prisma: PrismaService) {}

  async getVenueTimeslots(tenantId: string, venueId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId, tenantId } });
    if (!venue) throw new NotFoundException('Venue not found');
    return (venue.settings as any)?.timeslots ?? {
      mode: 'full_day',
      sessions: [{ id: 'full_day', label: 'Full Day', start: '00:00', end: '23:59', priceMultiplier: 1, active: true }],
    };
  }

  async updateVenueTimeslots(tenantId: string, venueId: string, dto: VenueTimeslotsDto) {
    if (!dto || !dto.mode || !Array.isArray(dto.sessions) || !dto.sessions.length) {
      throw new BadRequestException('Invalid timeslot payload');
    }
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId, tenantId } });
    if (!venue) throw new NotFoundException('Venue not found');
    const updated = await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: { settings: { ...(venue.settings as any), timeslots: dto } },
    });
    return (updated.settings as any).timeslots;
  }
}
