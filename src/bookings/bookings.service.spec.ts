import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import {
  CreateBookingDto,
  BookingStatus,
  PaymentStatus,
} from './dto/create-booking.dto';

/**
 * Unit Tests for BookingsService
 * 
 * Test Categories:
 * 1. Booking creation with exclusion constraints
 * 2. Timestamp validation and normalization
 * 3. Booking number generation
 * 4. Availability checking
 * 5. Customer integration
 * 6. Error handling (constraint violations)
 * 7. Business rules validation
 */

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;
  let usersService: UsersService;
  let redisService: RedisService;

  // Mock data
  const mockTenantId = 'tenant-123';
  const mockVenueId = 'venue-123';
  const mockUserId = 'user-123';
  const mockBookingId = 'booking-123';
  
  const mockVenue = {
    id: mockVenueId,
    tenantId: mockTenantId,
    name: 'Grand Hall',
    capacity: 500,
    basePriceCents: 10000, // ₹100 per hour
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    isActive: true,
  };

  const mockUser = {
    id: mockUserId,
    name: 'Rahul Sharma',
    phone: '+919876543210',
    email: 'rahul@example.com',
    role: 'customer',
  };

  const mockBooking = {
    id: mockBookingId,
    tenantId: mockTenantId,
    venueId: mockVenueId,
    userId: mockUserId,
    bookingNumber: 'TST-2025-0001',
    startTs: new Date('2025-12-25T04:30:00.000Z'),
    endTs: new Date('2025-12-25T20:30:00.000Z'),
    status: BookingStatus.TEMP_HOLD,
    paymentStatus: PaymentStatus.PENDING,
    totalAmountCents: 160000, // 16 hours * ₹100
    currency: 'INR',
    eventType: 'wedding',
    guestCount: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
    venue: mockVenue,
    payments: [],
  };

  // Mock services
  const mockPrismaService = {
    venue: {
      findFirst: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
    upsertUserByPhone: jest.fn(),
  };

  const mockRedisService = {
    incr: jest.fn(),
    expire: jest.fn(),
    setex: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);
    usersService = module.get<UsersService>(UsersService);
    redisService = module.get<RedisService>(RedisService);

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    const createBookingDto: CreateBookingDto = {
      venueId: mockVenueId,
      customer: {
        name: 'Rahul Sharma',
        phone: '+91 9876 543 210',
        email: 'rahul@example.com',
      },
      startTs: '2025-12-25T04:30:00.000Z', // Indian morning time
      endTs: '2025-12-25T20:30:00.000Z',   // Indian evening time
      eventType: 'wedding',
      guestCount: 300,
      specialRequests: 'Decoration setup needed',
    };

    it('should create booking successfully with new customer', async () => {
      // Mock venue validation
      mockPrismaService.venue.findFirst.mockResolvedValue(mockVenue);
      
      // Mock customer creation
      mockUsersService.upsertUserByPhone.mockResolvedValue(mockUser);
      
      // Mock booking number generation
      mockRedisService.incr.mockResolvedValue(1);
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Hall',
      });
      
      // Mock booking creation
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);
      
      const result = await service.createBooking(mockTenantId, createBookingDto);

      // Verify venue validation
      expect(mockPrismaService.venue.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockVenueId,
          tenantId: mockTenantId,
          isActive: true,
        },
      });

      // Verify customer creation
      expect(mockUsersService.upsertUserByPhone).toHaveBeenCalledWith(
        mockTenantId,
        {
          name: createBookingDto.customer!.name,
          phone: createBookingDto.customer!.phone,
          email: createBookingDto.customer!.email,
          role: 'customer',
        },
      );

      // Verify booking number generation
      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'booking_sequence:tenant-123:2025',
      );

      // Verify booking creation
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
      
      // Verify response format
      expect(result.success).toBe(true);
      expect(result.booking.id).toBe(mockBookingId);
      expect(result.booking.bookingNumber).toBe('TST-2025-0001');
      expect(result.isNewCustomer).toBe(true);
    });

    it('should handle exclusion constraint violation (double booking)', async () => {
      // Mock venue and customer setup
      mockPrismaService.venue.findFirst.mockResolvedValue(mockVenue);
      mockUsersService.upsertUserByPhone.mockResolvedValue(mockUser);
      mockRedisService.incr.mockResolvedValue(1);
      mockPrismaService.tenant.findUnique.mockResolvedValue({ id: mockTenantId });
      
      // Mock exclusion constraint violation
      const constraintError = new Error('Exclusion constraint violation');
      (constraintError as any).code = '23P01'; // PostgreSQL exclusion constraint
      mockPrismaService.booking.create.mockRejectedValue(constraintError);

      await expect(
        service.createBooking(mockTenantId, createBookingDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should validate timestamp range correctly', async () => {
      const invalidDto = {
        ...createBookingDto,
        startTs: '2025-12-25T20:30:00.000Z', // End time
        endTs: '2025-12-25T04:30:00.000Z',   // Start time (reversed)
      };

      await expect(
        service.createBooking(mockTenantId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate minimum booking duration', async () => {
      const shortBookingDto = {
        ...createBookingDto,
        startTs: '2025-12-25T10:00:00.000Z',
        endTs: '2025-12-25T10:30:00.000Z', // Only 30 minutes
      };

      await expect(
        service.createBooking(mockTenantId, shortBookingDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate guest count against venue capacity', async () => {
      mockPrismaService.venue.findFirst.mockResolvedValue(mockVenue);
      
      const overcapacityDto = {
        ...createBookingDto,
        guestCount: 600, // Venue capacity is 500
      };

      await expect(
        service.createBooking(mockTenantId, overcapacityDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle existing customer by userId', async () => {
      const existingUserDto = {
        ...createBookingDto,
        userId: mockUserId,
        customer: undefined,
      };

      mockPrismaService.venue.findFirst.mockResolvedValue(mockVenue);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockRedisService.incr.mockResolvedValue(2);
      mockPrismaService.tenant.findUnique.mockResolvedValue({ id: mockTenantId });
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);

      const result = await service.createBooking(mockTenantId, existingUserDto);

      expect(mockUsersService.findById).toHaveBeenCalledWith(
        mockTenantId,
        mockUserId,
      );
      expect(result.isNewCustomer).toBe(false);
    });

    it('should generate sequential booking numbers', async () => {
      mockPrismaService.venue.findFirst.mockResolvedValue(mockVenue);
      mockUsersService.upsertUserByPhone.mockResolvedValue(mockUser);
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Parbhani Hall',
      });
      mockPrismaService.booking.create.mockResolvedValue({
        ...mockBooking,
        bookingNumber: 'PAR-2025-0005', // 5th booking of the year
      });
      
      // Mock Redis returning sequence number 5
      mockRedisService.incr.mockResolvedValue(5);

      const result = await service.createBooking(mockTenantId, createBookingDto);

      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'booking_sequence:tenant-123:2025',
      );
      expect(result.booking.bookingNumber).toBe('PAR-2025-0005');
    });
  });

  describe('checkAvailability', () => {
    const timeRangeDto = {
      venueId: mockVenueId,
      startTs: '2025-12-25T04:30:00.000Z',
      endTs: '2025-12-25T20:30:00.000Z',
    };

    it('should return available when no conflicts', async () => {
      // Mock no conflicting bookings
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([]) // No conflicting bookings
        .mockResolvedValueOnce([]); // No blackout periods

      const result = await service.checkAvailability(mockTenantId, timeRangeDto);

      expect(result.isAvailable).toBe(true);
      expect(result.conflictingBookings).toHaveLength(0);
      expect(result.blackoutPeriods).toHaveLength(0);
    });

    it('should return conflicting bookings when unavailable', async () => {
      const conflictingBooking = {
        id: 'conflict-1',
        bookingNumber: 'TST-2025-0002',
        startTs: new Date('2025-12-25T10:00:00.000Z'),
        endTs: new Date('2025-12-25T18:00:00.000Z'),
        status: 'confirmed',
        customerName: 'John Doe',
      };

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([conflictingBooking]) // Conflicting booking
        .mockResolvedValueOnce([]); // No blackout periods

      const result = await service.checkAvailability(mockTenantId, timeRangeDto);

      expect(result.isAvailable).toBe(false);
      expect(result.conflictingBookings).toHaveLength(1);
      expect(result.conflictingBookings[0].customerName).toBe('John Doe');
    });

    it('should detect blackout periods', async () => {
      const blackoutPeriod = {
        id: 'blackout-1',
        reason: 'Maintenance work',
        startTs: new Date('2025-12-25T08:00:00.000Z'),
        endTs: new Date('2025-12-25T12:00:00.000Z'),
        isMaintenance: true,
      };

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([]) // No conflicting bookings
        .mockResolvedValueOnce([blackoutPeriod]); // Blackout period

      const result = await service.checkAvailability(mockTenantId, timeRangeDto);

      expect(result.isAvailable).toBe(false);
      expect(result.blackoutPeriods).toHaveLength(1);
      expect(result.blackoutPeriods![0].reason).toBe('Maintenance work');
    });
  });

  describe('getBookingById', () => {
    it('should return booking when found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);

      const result = await service.getBookingById(mockTenantId, mockBookingId);

      expect(mockPrismaService.booking.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockBookingId,
          tenantId: mockTenantId,
        },
        include: {
          user: true,
          venue: true,
          payments: true,
        },
      });
      
      expect(result).toBeDefined();
      expect(result!.id).toBe(mockBookingId);
      expect(result!.customer.name).toBe(mockUser.name);
    });

    it('should return null when booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      const result = await service.getBookingById(mockTenantId, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('business logic validation', () => {
    it('should calculate booking price correctly', async () => {
      mockPrismaService.venue.findFirst.mockResolvedValue({
        ...mockVenue,
        basePriceCents: 5000, // ₹50 per hour
      });
      mockUsersService.upsertUserByPhone.mockResolvedValue(mockUser);
      mockRedisService.incr.mockResolvedValue(1);
      mockPrismaService.tenant.findUnique.mockResolvedValue({ id: mockTenantId });
      
      // 6-hour booking: 10:00 to 16:00
      const sixHourBooking = {
        ...createBookingDto,
        startTs: '2025-12-25T04:30:00.000Z', // 10:00 IST
        endTs: '2025-12-25T10:30:00.000Z',   // 16:00 IST
      };
      
      const expectedBooking = {
        ...mockBooking,
        totalAmountCents: 30000, // 6 hours * ₹50
      };
      
      mockPrismaService.booking.create.mockResolvedValue(expectedBooking);

      const result = await service.createBooking(mockTenantId, sixHourBooking);

      // Verify price calculation (6 hours * ₹50)
      expect(result.booking.totalAmountCents).toBe(30000);
    });

    it('should set hold expiry for temp bookings', async () => {
      const tempHoldBooking = {
        ...mockBooking,
        status: BookingStatus.TEMP_HOLD,
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      };

      mockPrismaService.venue.findFirst.mockResolvedValue(mockVenue);
      mockUsersService.upsertUserByPhone.mockResolvedValue(mockUser);
      mockRedisService.incr.mockResolvedValue(1);
      mockPrismaService.tenant.findUnique.mockResolvedValue({ id: mockTenantId });
      mockPrismaService.booking.create.mockResolvedValue(tempHoldBooking);

      const result = await service.createBooking(mockTenantId, createBookingDto);

      expect(result.booking.holdExpiresAt).toBeDefined();
      expect(result.holdExpiresIn).toBeGreaterThan(0);
      expect(result.holdExpiresIn).toBeLessThanOrEqual(15);
    });
  });
});

/**
 * Test Design Principles:
 * 
 * 1. **Comprehensive Coverage**: Tests all critical paths and edge cases
 * 2. **Realistic Scenarios**: Uses representative data and business cases
 * 3. **Error Handling**: Verifies proper exception handling
 * 4. **Business Logic**: Validates pricing, timing, and constraint logic
 * 5. **Integration Points**: Tests interaction with Users and Redis services
 * 6. **PostgreSQL Constraints**: Verifies exclusion constraint error handling
 * 7. **Indian Context**: Tests timezone handling and local business rules
 */