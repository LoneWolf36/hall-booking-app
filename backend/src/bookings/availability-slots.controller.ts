import { Public } from '../auth/decorators/public.decorator';
import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('bookings/venue')
export class AvailabilitySlotsController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get(':id/availability/slots')
  async getSlots(
    @Param('id', ParseUUIDPipe) venueId: string,
    @Query('date') date: string,
  ) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    const ts = (venue?.settings as any)?.timeslots;
    const sessions = (ts?.sessions || [{ id: 'full_day', label: 'Full Day', start: '00:00', end: '23:59', active: true }]).filter((s: any) => s.active !== false);
    const base = new Date(date);
    const bookings = await this.prisma.booking.findMany({ where: { venueId, startTs: { gte: new Date(base.getFullYear(), base.getMonth(), base.getDate()) }, endTs: { lte: new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1) } } });

    const results = sessions.map((s: any) => {
      const sStart = new Date(date + 'T' + s.start + ':00Z');
      const sEnd = new Date(date + 'T' + (s.end === '23:59' ? '00:00' : s.end) + ':00Z');
      if (s.end === '23:59') sEnd.setUTCDate(sEnd.getUTCDate() + 1);
      const overlap = bookings.some(b => !(b.endTs <= sStart || b.startTs >= sEnd));
      return { id: s.id, label: s.label, start: s.start, end: s.end, isAvailable: !overlap };
    });

    return { success: true, data: { date, sessions: results } };
  }
}
