/**
 * Admin Service - Simplified for Phase 5
 * Phase5-T-037
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/common/services/cache.service';
import { ApproveBookingDto, RejectBookingDto, RecordCashPaymentDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async approveBooking(
    tenantId: string,
    bookingId: string,
    userId: string,
    dto: ApproveBookingDto
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!['pending', 'temp_hold'].includes(booking.status)) {
      throw new BadRequestException(`Cannot approve booking with status: ${booking.status}`);
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'confirmed',
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
    });

    await this.cache.invalidateBookingCache(bookingId);
    return updated;
  }

  async rejectBooking(
    tenantId: string,
    bookingId: string,
    userId: string,
    dto: RejectBookingDto
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Can only reject pending/temp_hold bookings
    if (!['pending', 'temp_hold'].includes(booking.status)) {
      throw new BadRequestException(`Cannot reject booking with status: ${booking.status}`);
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'rejected',
        // TODO: Add rejectedBy, rejectedAt after schema migration
      },
    });

    await this.cache.invalidateBookingCache(bookingId);
    return updated;
  }

  async recordCashPayment(
    tenantId: string,
    userId: string,
    dto: RecordCashPaymentDto
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, tenantId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentMethod !== 'cash_full') {
      throw new BadRequestException('This booking does not accept cash payments');
    }

    // TODO: Use bookingPayment model after Prisma regeneration
    // For now, just update booking status
    await this.prisma.booking.update({
      where: { id: dto.bookingId },
      data: { paymentStatus: 'paid' },
    });

    return { id: dto.bookingId, amount: dto.paidAmount, method: 'cash' };
  }

  async getBookingForReview(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async getDashboardAnalytics(tenantId: string) {
    const [pendingCount, confirmedCount, rejectedCount] = await Promise.all([
      this.prisma.booking.count({ where: { tenantId, status: 'pending' } }),
      this.prisma.booking.count({ where: { tenantId, status: 'confirmed' } }),
      this.prisma.booking.count({ where: { tenantId, status: 'rejected' } }),
    ]);

    return {
      pendingBookings: pendingCount,
      confirmedBookings: confirmedCount,
      rejectedBookings: rejectedCount,
    };
  }
}
