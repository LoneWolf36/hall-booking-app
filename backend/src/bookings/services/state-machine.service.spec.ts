import { Test, TestingModule } from '@nestjs/testing';
import { BookingStateMachineService } from './state-machine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { BookingStatus, BookingEvent } from '../dto/booking-state.dto';

describe('BookingStateMachineService', () => {
  let service: BookingStateMachineService;
  let prisma: PrismaService;
  let cache: CacheService;

  const mockBooking = {
    id: 'booking-123',
    tenantId: 'tenant-123',
    status: 'temp_hold',
    venueId: 'venue-123',
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    venue: {
      paymentProfile: 'cash_only',
      confirmationTrigger: 'manual_approval',
    },
    paymentStatus: 'unpaid',
    confirmedBy: null,
    confirmedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStateMachineService,
        {
          provide: PrismaService,
          useValue: {
            booking: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
          },
        },
        {
          provide: CacheService,
          useValue: {
            delete: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingStateMachineService>(BookingStateMachineService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transition', () => {
    it('should successfully transition from temp_hold to expired', async () => {
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue(mockBooking as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return await callback({
          booking: {
            update: jest.fn().mockResolvedValue({ ...mockBooking, status: 'expired' }),
          },
        });
      });

      const result = await service.transition(
        'booking-123',
        'tenant-123',
        BookingEvent.EXPIRE_HOLD,
      );

      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe(BookingStatus.TEMP_HOLD);
      expect(result.toStatus).toBe(BookingStatus.EXPIRED);
      expect(result.event).toBe(BookingEvent.EXPIRE_HOLD);
    });

    it('should successfully transition from temp_hold to pending', async () => {
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue(mockBooking as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return await callback({
          booking: {
            update: jest.fn().mockResolvedValue({ ...mockBooking, status: 'pending' }),
          },
        });
      });

      const result = await service.transition(
        'booking-123',
        'tenant-123',
        BookingEvent.SELECT_PAYMENT,
      );

      expect(result.success).toBe(true);
      expect(result.toStatus).toBe(BookingStatus.PENDING);
    });

    it('should transition from pending to confirmed with confirmedBy', async () => {
      const pendingBooking = { ...mockBooking, status: 'pending' };
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue(pendingBooking as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return await callback({
          booking: {
            update: jest.fn().mockResolvedValue({ ...pendingBooking, status: 'confirmed' }),
          },
        });
      });

      const result = await service.transition(
        'booking-123',
        'tenant-123',
        BookingEvent.MANUAL_CONFIRM,
        { confirmedBy: 'user-456' },
      );

      expect(result.success).toBe(true);
      expect(result.toStatus).toBe(BookingStatus.CONFIRMED);
    });

    it('should fail transition without required confirmedBy', async () => {
      const pendingBooking = { ...mockBooking, status: 'pending' };
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue(pendingBooking as any);

      const result = await service.transition(
        'booking-123',
        'tenant-123',
        BookingEvent.MANUAL_CONFIRM,
        {}, // No confirmedBy
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('condition not met');
    });

    it('should fail invalid transition', async () => {
      const confirmedBooking = { ...mockBooking, status: 'confirmed' };
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue(confirmedBooking as any);

      const result = await service.transition(
        'booking-123',
        'tenant-123',
        BookingEvent.EXPIRE_HOLD, // Can't expire a confirmed booking
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('should handle booking not found', async () => {
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue(null);

      await expect(
        service.transition('invalid-id', 'tenant-123', BookingEvent.EXPIRE_HOLD),
      ).rejects.toThrow('Booking not found');
    });

    it('should invalidate cache after successful transition', async () => {
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue(mockBooking as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return await callback({
          booking: {
            update: jest.fn().mockResolvedValue({ ...mockBooking, status: 'expired' }),
          },
        });
      });
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue({ venueId: 'venue-123' } as any);

      await service.transition('booking-123', 'tenant-123', BookingEvent.EXPIRE_HOLD);

      expect(cache.delete).toHaveBeenCalledWith('booking:tenant-123:booking-123');
    });
  });

  describe('isValidTransition', () => {
    it('should allow valid transitions', () => {
      expect(service.isValidTransition(BookingStatus.TEMP_HOLD, BookingStatus.PENDING)).toBe(true);
      expect(service.isValidTransition(BookingStatus.TEMP_HOLD, BookingStatus.EXPIRED)).toBe(true);
      expect(service.isValidTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)).toBe(true);
      expect(service.isValidTransition(BookingStatus.CONFIRMED, BookingStatus.COMPLETED)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(service.isValidTransition(BookingStatus.EXPIRED, BookingStatus.CONFIRMED)).toBe(false);
      expect(service.isValidTransition(BookingStatus.CANCELLED, BookingStatus.CONFIRMED)).toBe(false);
      expect(service.isValidTransition(BookingStatus.COMPLETED, BookingStatus.PENDING)).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('should identify terminal states', () => {
      expect(service.isTerminalState(BookingStatus.CANCELLED)).toBe(true);
      expect(service.isTerminalState(BookingStatus.EXPIRED)).toBe(true);
      expect(service.isTerminalState(BookingStatus.COMPLETED)).toBe(true);
    });

    it('should identify non-terminal states', () => {
      expect(service.isTerminalState(BookingStatus.TEMP_HOLD)).toBe(false);
      expect(service.isTerminalState(BookingStatus.PENDING)).toBe(false);
      expect(service.isTerminalState(BookingStatus.CONFIRMED)).toBe(false);
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return available transitions for temp_hold', async () => {
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue({ status: 'temp_hold' } as any);

      const transitions = await service.getAvailableTransitions('booking-123', 'tenant-123');

      expect(transitions).toContain(BookingEvent.EXPIRE_HOLD);
      expect(transitions).toContain(BookingEvent.SELECT_PAYMENT);
      expect(transitions).toContain(BookingEvent.CANCEL);
    });

    it('should return available transitions for pending', async () => {
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue({ status: 'pending' } as any);

      const transitions = await service.getAvailableTransitions('booking-123', 'tenant-123');

      expect(transitions).toContain(BookingEvent.MANUAL_CONFIRM);
      expect(transitions).toContain(BookingEvent.CANCEL);
    });

    it('should return empty array for terminal states', async () => {
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue({ status: 'cancelled' } as any);

      const transitions = await service.getAvailableTransitions('booking-123', 'tenant-123');

      expect(transitions).toEqual([]);
    });

    it('should return empty array for non-existent booking', async () => {
      jest.spyOn(prisma.booking, 'findFirst').mockResolvedValue(null);

      const transitions = await service.getAvailableTransitions('invalid-id', 'tenant-123');

      expect(transitions).toEqual([]);
    });
  });

  describe('batchExpireHolds', () => {
    it('should expire multiple temp_hold bookings', async () => {
      const expiredBookings = [
        { id: 'booking-1', tenantId: 'tenant-123', status: 'temp_hold' },
        { id: 'booking-2', tenantId: 'tenant-123', status: 'temp_hold' },
      ];

      jest.spyOn(prisma.booking, 'findMany').mockResolvedValue(expiredBookings as any);
      jest.spyOn(prisma.booking, 'findFirst').mockImplementation((args: any) => {
        const booking = expiredBookings.find((b) => b.id === args.where.id);
        return Promise.resolve({ ...mockBooking, ...booking } as any);
      });
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return await callback({
          booking: {
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const count = await service.batchExpireHolds('tenant-123', 100);

      expect(count).toBe(2);
    });

    it('should return 0 when no expired bookings found', async () => {
      jest.spyOn(prisma.booking, 'findMany').mockResolvedValue([]);

      const count = await service.batchExpireHolds('tenant-123', 100);

      expect(count).toBe(0);
    });

    it('should respect batch limit', async () => {
      const manyBookings = Array(150)
        .fill(null)
        .map((_, i) => ({ id: `booking-${i}`, tenantId: 'tenant-123' }));

      const findManySpy = jest.spyOn(prisma.booking, 'findMany').mockResolvedValue([]);

      await service.batchExpireHolds('tenant-123', 50);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });
  });

  describe('batchCompleteBookings', () => {
    it('should complete finished bookings', async () => {
      const finishedBookings = [
        { id: 'booking-1', tenantId: 'tenant-123', status: 'confirmed' },
        { id: 'booking-2', tenantId: 'tenant-123', status: 'confirmed' },
      ];

      jest.spyOn(prisma.booking, 'findMany').mockResolvedValue(finishedBookings as any);
      jest.spyOn(prisma.booking, 'findFirst').mockImplementation((args: any) => {
        const booking = finishedBookings.find((b) => b.id === args.where.id);
        return Promise.resolve({
          ...mockBooking,
          ...booking,
          status: 'confirmed',
        } as any);
      });
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return await callback({
          booking: {
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const count = await service.batchCompleteBookings('tenant-123', 100);

      expect(count).toBe(2);
    });
  });
});
