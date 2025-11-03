import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addMinutes } from 'date-fns';

interface CreateBookingDto {
  venueId: string;
  eventType: string;
  guestCount: number;
  specialRequests?: string;
  startTs: string;
  endTs: string;
  selectedDates: string[];
  idempotencyKey: string;
}

@Controller('bookings')
export class BookingsControllerExtended {
  constructor(private prisma: PrismaService) {}

  private async getVenueTimeslots(venueId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    return (venue?.settings as any)?.timeslots ?? null;
  }

  private matchesSession(start: Date, end: Date, session: { start: string; end: string }) {
    const startHM = start.toISOString().slice(11, 16);
    const endHM = end.toISOString().slice(11, 16);
    // allow 1 minute tolerance for 23:59 vs 00:00 next day handling
    if (session.end === '23:59') {
      const endMinus1 = addMinutes(end, -1).toISOString().slice(11, 16);
      return startHM === session.start && endMinus1 === session.end;
    }
    return startHM === session.start && endHM === session.end;
  }

  @Post()
  async create(@Body() dto: CreateBookingDto) {
    // Enforce session policy if configured
    const tsConfig = await this.getVenueTimeslots(dto.venueId);
    if (tsConfig) {
      const start = new Date(dto.startTs);
      const end = new Date(dto.endTs);
      const active = (tsConfig.sessions || []).filter((s: any) => s.active !== false);
      const isFullDayMode = tsConfig.mode === 'full_day';
      const ok = isFullDayMode
        ? this.matchesSession(start, end, { start: '00:00', end: '23:59' })
        : active.some((s: any) => this.matchesSession(start, end, { start: s.start, end: s.end }));
      if (!ok) throw new HttpException('Selected time does not match venue sessions', HttpStatus.BAD_REQUEST);
    }

    // Delegate to existing create path (assumes there is another controller in project)
    return { success: true, message: 'Validated by timeslot guard. Use existing create handler to persist.' };
  }
}
