import { Test, TestingModule } from '@nestjs/testing';
import { BookingsControllerExtended } from './bookings.controller.extended';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';
import { BadRequestException } from '@nestjs/common';

describe('Booking Timeslot Guard', () => {
  let controller: BookingsControllerExtended;
  let prismaService: PrismaService;

  const mockPrismaService = {
    venue: {
      findUnique: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsControllerExtended],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<BookingsControllerExtended>(BookingsControllerExtended);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Time Validation', () => {
    it('should reject booking when start/end times do not match any active session', async () => {
      const venueId = 'test-venue-id';
      const dto = {
        venueId,
        selectedDates: ['2025-11-15'],
        startTs: '2025-11-15T10:00:00Z', // Not matching any session
        endTs: '2025-11-15T14:00:00Z',
        guestCount: 50,
        eventType: 'wedding',
        idempotencyKey: 'test-key-1',
      };

      // Mock venue with fixed sessions
      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {
          timeslots: {
            mode: 'fixed_sessions',
            sessions: [
              { id: 'morning', label: 'Morning', start: '09:00', end: '15:00', active: true },
              { id: 'evening', label: 'Evening', start: '16:00', end: '22:00', active: true },
            ],
          },
        },
      });

      await expect(controller.create(dto as any)).rejects.toThrow('Selected time does not match venue sessions');
    });

    it('should accept booking when times match an active session exactly', async () => {
      const venueId = 'test-venue-id';
      const dto = {
        venueId,
        selectedDates: ['2025-11-15'],
        startTs: '2025-11-15T09:00:00Z',
        endTs: '2025-11-15T15:00:00Z',
        guestCount: 50,
        eventType: 'wedding',
        idempotencyKey: 'test-key-2',
      };

      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {
          timeslots: {
            mode: 'fixed_sessions',
            sessions: [
              { id: 'morning', label: 'Morning', start: '09:00', end: '15:00', active: true },
              { id: 'evening', label: 'Evening', start: '16:00', end: '22:00', active: true },
            ],
          },
        },
      });

      const result = await controller.create(dto as any);
      expect(result.success).toBe(true);
    });

    it('should reject booking for inactive session even if times match', async () => {
      const venueId = 'test-venue-id';
      const dto = {
        venueId,
        selectedDates: ['2025-11-15'],
        startTs: '2025-11-15T09:00:00Z',
        endTs: '2025-11-15T15:00:00Z',
        guestCount: 50,
        eventType: 'wedding',
        idempotencyKey: 'test-key-3',
      };

      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {
          timeslots: {
            mode: 'fixed_sessions',
            sessions: [
              { id: 'morning', label: 'Morning', start: '09:00', end: '15:00', active: false },
              { id: 'evening', label: 'Evening', start: '16:00', end: '22:00', active: true },
            ],
          },
        },
      });

      await expect(controller.create(dto as any)).rejects.toThrow();
    });

    it('should allow any times for full_day mode', async () => {
      const venueId = 'test-venue-id';
      const dto = {
        venueId,
        selectedDates: ['2025-11-15'],
        startTs: '2025-11-15T00:00:00Z',
        endTs: '2025-11-15T23:59:00Z',
        guestCount: 50,
        eventType: 'wedding',
        idempotencyKey: 'test-key-4',
      };

      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {
          timeslots: {
            mode: 'full_day',
            sessions: [
              { id: 'full_day', label: 'Full Day', start: '00:00', end: '23:59', active: true },
            ],
          },
        },
      });

      const result = await controller.create(dto as any);
      expect(result.success).toBe(true);
    });

    it('should allow any times when no timeslot configuration exists', async () => {
      const venueId = 'test-venue-id';
      const dto = {
        venueId,
        selectedDates: ['2025-11-15'],
        startTs: '2025-11-15T10:00:00Z',
        endTs: '2025-11-15T14:00:00Z',
        guestCount: 50,
        eventType: 'wedding',
        idempotencyKey: 'test-key-5',
      };

      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {},
      });

      const result = await controller.create(dto as any);
      expect(result.success).toBe(true);
    });
  });
});
