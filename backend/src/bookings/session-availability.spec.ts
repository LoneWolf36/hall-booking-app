import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('Session Availability Per Date', () => {
  let controller: AvailabilitySlotsController;
  let prismaService: PrismaService;

  const mockPrismaService = {
    venue: {
      findUnique: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilitySlotsController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<AvailabilitySlotsController>(AvailabilitySlotsController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /bookings/venue/:id/availability/slots', () => {
    const venueId = 'test-venue-id';
    const testDate = '2025-11-15';

    it('should return all sessions as available when no bookings exist', async () => {
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

      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await controller.getAvailableSlots(venueId, testDate);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'morning',
        label: 'Morning',
        isAvailable: true,
      });
      expect(result[1]).toMatchObject({
        id: 'evening',
        label: 'Evening',
        isAvailable: true,
      });
    });

    it('should mark session as unavailable when a confirmed booking exists for that date and time', async () => {
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

      // Mock existing confirmed booking for morning session
      mockPrismaService.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          venueId,
          status: 'confirmed',
          startDate: new Date('2025-11-15T09:00:00Z'),
          endDate: new Date('2025-11-15T09:00:00Z'),
          startTime: '09:00',
          endTime: '15:00',
        },
      ]);

      const result = await controller.getAvailableSlots(venueId, testDate);

      expect(result).toHaveLength(2);
      
      const morningSlot = result.find(s => s.id === 'morning');
      const eveningSlot = result.find(s => s.id === 'evening');

      expect(morningSlot?.isAvailable).toBe(false);
      expect(eveningSlot?.isAvailable).toBe(true);
    });

    it('should mark session as unavailable for pending bookings (not just confirmed)', async () => {
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

      // Mock pending booking
      mockPrismaService.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          venueId,
          status: 'pending',
          startDate: new Date('2025-11-15T16:00:00Z'),
          endDate: new Date('2025-11-15T16:00:00Z'),
          startTime: '16:00',
          endTime: '22:00',
        },
      ]);

      const result = await controller.getAvailableSlots(venueId, testDate);

      const eveningSlot = result.find(s => s.id === 'evening');
      expect(eveningSlot?.isAvailable).toBe(false);
    });

    it('should not mark session unavailable for rejected bookings', async () => {
      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {
          timeslots: {
            mode: 'fixed_sessions',
            sessions: [
              { id: 'morning', label: 'Morning', start: '09:00', end: '15:00', active: true },
            ],
          },
        },
      });

      // Mock rejected booking
      mockPrismaService.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          venueId,
          status: 'rejected',
          startDate: new Date('2025-11-15T09:00:00Z'),
          endDate: new Date('2025-11-15T09:00:00Z'),
          startTime: '09:00',
          endTime: '15:00',
        },
      ]);

      const result = await controller.getAvailableSlots(venueId, testDate);

      const morningSlot = result.find(s => s.id === 'morning');
      expect(morningSlot?.isAvailable).toBe(true);
    });

    it('should not mark session unavailable for cancelled bookings', async () => {
      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {
          timeslots: {
            mode: 'fixed_sessions',
            sessions: [
              { id: 'morning', label: 'Morning', start: '09:00', end: '15:00', active: true },
            ],
          },
        },
      });

      mockPrismaService.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          venueId,
          status: 'cancelled',
          startDate: new Date('2025-11-15T09:00:00Z'),
          endDate: new Date('2025-11-15T09:00:00Z'),
          startTime: '09:00',
          endTime: '15:00',
        },
      ]);

      const result = await controller.getAvailableSlots(venueId, testDate);

      const morningSlot = result.find(s => s.id === 'morning');
      expect(morningSlot?.isAvailable).toBe(true);
    });

    it('should handle multi-day bookings correctly', async () => {
      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {
          timeslots: {
            mode: 'fixed_sessions',
            sessions: [
              { id: 'morning', label: 'Morning', start: '09:00', end: '15:00', active: true },
            ],
          },
        },
      });

      // Booking spans Nov 14-16, should affect Nov 15
      mockPrismaService.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          venueId,
          status: 'confirmed',
          startDate: new Date('2025-11-14T09:00:00Z'),
          endDate: new Date('2025-11-16T09:00:00Z'),
          startTime: '09:00',
          endTime: '15:00',
        },
      ]);

      const result = await controller.getAvailableSlots(venueId, testDate);

      const morningSlot = result.find(s => s.id === 'morning');
      expect(morningSlot?.isAvailable).toBe(false);
    });

    it('should only hide inactive sessions', async () => {
      mockPrismaService.venue.findUnique.mockResolvedValue({
        id: venueId,
        settings: {
          timeslots: {
            mode: 'fixed_sessions',
            sessions: [
              { id: 'morning', label: 'Morning', start: '09:00', end: '15:00', active: true },
              { id: 'afternoon', label: 'Afternoon', start: '12:00', end: '18:00', active: false },
              { id: 'evening', label: 'Evening', start: '16:00', end: '22:00', active: true },
            ],
          },
        },
      });

      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await controller.getAvailableSlots(venueId, testDate);

      // Should only return active sessions
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['morning', 'evening']);
    });

    it('should return full_day session for venues without fixed sessions', async () => {
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

      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await controller.getAvailableSlots(venueId, testDate);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'full_day',
        label: 'Full Day',
        isAvailable: true,
      });
    });
  });
});
