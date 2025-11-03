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
    // Validate date format
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { success: false, message: 'Invalid date format. Expected YYYY-MM-DD' };
    }

    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) {
      return { success: false, message: 'Venue not found' };
    }

    const ts = (venue?.settings as any)?.timeslots;
    const sessions = (ts?.sessions || [{ id: 'full_day', label: 'Full Day', start: '00:00', end: '23:59', active: true }]).filter((s: any) => s.active !== false);
    
    const base = new Date(date);
    // Get bookings for the entire day (from 00:00 to 23:59)
    const startOfDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const endOfDay = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    
    const bookings = await this.prisma.booking.findMany({ 
      where: { 
        venueId, 
        startTs: { lt: endOfDay },
        endTs: { gt: startOfDay },
        status: { in: ['pending', 'confirmed'] } // Only consider active bookings
      } 
    });

    const results = sessions.map((s: any) => {
      const sStart = new Date(date + 'T' + s.start + ':00');
      const sEnd = new Date(date + 'T' + (s.end === '23:59' ? '00:00' : s.end) + ':00');
      if (s.end === '23:59') {
        sEnd.setDate(sEnd.getDate() + 1);
      }
      
      // Check if any booking overlaps with this session
      const overlap = bookings.some(b => {
        return !(b.endTs <= sStart || b.startTs >= sEnd);
      });
      
      return { 
        id: s.id, 
        label: s.label, 
        start: s.start, 
        end: s.end, 
        isAvailable: !overlap 
      };
    });

    return { success: true, data: { date, sessions: results } };
  }
}
