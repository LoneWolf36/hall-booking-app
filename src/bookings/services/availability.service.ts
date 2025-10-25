import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { suggestAlternatives } from '../utils/suggest-alternatives';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getConflicts(tenantId: string, venueId: string, start: Date, end: Date) {
    const conflicts = await this.prisma.booking.findMany({
      where: {
        tenantId,
        venueId,
        status: { in: ['temp_hold', 'pending', 'confirmed'] },
        AND: [
          { startTs: { lt: end } },
          { endTs: { gt: start } },
        ],
      },
      select: { id: true, startTs: true, endTs: true },
      orderBy: { startTs: 'asc' },
    });
    return conflicts;
  }

  async alternativesOnConflict(
    tenantId: string,
    venueId: string,
    requestedStart: Date,
    requestedEnd: Date,
  ) {
    const conflicts = await this.getConflicts(tenantId, venueId, requestedStart, requestedEnd);
    if (conflicts.length === 0) return [];
    return suggestAlternatives(requestedStart, requestedEnd, conflicts);
  }
}
