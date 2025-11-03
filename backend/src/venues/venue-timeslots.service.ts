import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type VenueTimeslotMode = 'full_day' | 'fixed_sessions' | 'custom';
export interface VenueSessionDto { id: string; label: string; start: string; end: string; priceMultiplier?: number; active?: boolean }
export interface VenueTimeslotsDto { mode: VenueTimeslotMode; sessions: VenueSessionDto[] }

@Injectable()
export class VenueTimeslotsService {
  constructor(private prisma: PrismaService) {}

  async get(tenantId: string, venueId: string): Promise<VenueTimeslotsDto> {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId, tenantId } });
    if (!venue) throw new NotFoundException('Venue not found');
    const ts = (venue.settings as any)?.timeslots;
    return ts ?? { mode: 'full_day', sessions: [{ id: 'full_day', label: 'Full Day', start: '00:00', end: '23:59', priceMultiplier: 1, active: true }] };
  }

  private validate(dto: VenueTimeslotsDto) {
    if (!dto || !dto.mode) throw new BadRequestException('mode is required');
    if (!Array.isArray(dto.sessions) || dto.sessions.length === 0) throw new BadRequestException('sessions required');
    dto.sessions.forEach(s => {
      if (!/^\d{2}:\d{2}$/.test(s.start) || !/^\d{2}:\d{2}$/.test(s.end)) throw new BadRequestException('HH:mm required');
      if (!s.id || !s.label) throw new BadRequestException('id/label required');
    });
  }

  async update(tenantId: string, venueId: string, dto: VenueTimeslotsDto) {
    this.validate(dto);
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId, tenantId } });
    if (!venue) throw new NotFoundException('Venue not found');
    const updated = await this.prisma.venue.update({
      where: { id: venueId, tenantId },
      data: { settings: { ...(venue.settings as any), timeslots: dto } },
    });
    return (updated.settings as any).timeslots;
  }
}
