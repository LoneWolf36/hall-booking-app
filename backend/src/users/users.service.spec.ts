import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from '../common/services/validation.service';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Unit Tests for UsersService
 *
 * Test Categories:
 * 1. User upsert functionality
 * 2. Phone number normalization
 * 3. Duplicate handling
 * 4. Role validation
 * 5. Error scenarios
 * 6. Multi-tenant isolation
 */

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  // Mock data
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockUser = {
    id: mockUserId,
    tenantId: mockTenantId,
    name: 'John Doe',
    phone: '+919876543210',
    email: 'john@example.com',
    role: 'customer',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  };

  const mockValidationService = {
    validateCustomerName: jest.fn(),
    validatePhoneNumber: jest.fn(),
    validateEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ValidationService,
          useValue: mockValidationService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe('upsertUserByPhone', () => {
    const createUserDto: CreateUserDto = {
      name: 'John Doe',
      phone: '+91 9876 543 210', // With spaces (should be normalized)
      email: 'john@example.com',
      role: UserRole.CUSTOMER,
    };

    it('should create a new user when phone does not exist', async () => {
      // Mock tenant exists
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
      });

      // Mock user creation
      mockPrismaService.user.upsert.mockResolvedValue(mockUser);

      const result = await service.upsertUserByPhone(
        mockTenantId,
        createUserDto,
      );

      expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_phone: {
            tenantId: mockTenantId,
            phone: '+919876543210', // Normalized phone
          },
        },
        update: {
          name: createUserDto.name,
          email: createUserDto.email,
          role: createUserDto.role,
        },
        create: {
          tenantId: mockTenantId,
          name: createUserDto.name,
          phone: '+919876543210',
          email: createUserDto.email,
          role: UserRole.CUSTOMER,
        },
      });

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        phone: mockUser.phone,
        email: mockUser.email,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should update existing user when phone exists', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
      });

      const updatedUser = { ...mockUser, name: 'John Updated' };
      mockPrismaService.user.upsert.mockResolvedValue(updatedUser);

      const result = await service.upsertUserByPhone(
        mockTenantId,
        createUserDto,
      );

      expect(result.name).toBe('John Updated');
    });

    it('should normalize phone number correctly', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
      });
      mockPrismaService.user.upsert.mockResolvedValue(mockUser);

      const testCases = [
        { input: '9876543210', expected: '+919876543210' },
        { input: '+91 9876 543 210', expected: '+919876543210' },
        { input: '+91-9876-543-210', expected: '+919876543210' },
        { input: '+91(9876)543210', expected: '+919876543210' },
      ];

      for (const testCase of testCases) {
        const dto = { ...createUserDto, phone: testCase.input };
        await service.upsertUserByPhone(mockTenantId, dto);

        const lastCall =
          mockPrismaService.user.upsert.mock.calls.slice(-1)[0][0];
        expect(lastCall.where.tenantId_phone.phone).toBe(testCase.expected);
        expect(lastCall.create.phone).toBe(testCase.expected);
      }
    });

    it('should throw BadRequestException for invalid tenant', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertUserByPhone('invalid-tenant', createUserDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle Prisma constraint errors', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
      });

      const prismaError = new Error('Constraint violation');
      (prismaError as any).code = 'P2002';
      mockPrismaService.user.upsert.mockRejectedValue(prismaError);

      await expect(
        service.upsertUserByPhone(mockTenantId, createUserDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByPhone', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByPhone(mockTenantId, '+919876543210');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_phone: {
            tenantId: mockTenantId,
            phone: '+919876543210',
          },
        },
      });
      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByPhone(mockTenantId, '+919876543210');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    const updateDto: UpdateUserDto = {
      name: 'John Updated',
      email: 'john.updated@example.com',
    };

    it('should update user successfully', async () => {
      // Mock finding existing user
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const updatedUser = { ...mockUser, ...updateDto };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUser(
        mockTenantId,
        mockUserId,
        updateDto,
      );

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          name: updateDto.name,
          email: updateDto.email,
        },
      });
      expect(result.name).toBe(updateDto.name);
      expect(result.email).toBe(updateDto.email);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateUser(mockTenantId, mockUserId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle phone number conflicts', async () => {
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(mockUser) // Existing user
        .mockResolvedValueOnce({ ...mockUser, id: 'other-user' }); // Phone conflict

      const updateWithPhone: UpdateUserDto = {
        phone: '+919999999999',
      };

      await expect(
        service.updateUser(mockTenantId, mockUserId, updateWithPhone),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUserRole', () => {
    it('should return true when user has required role', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.validateUserRole(
        mockTenantId,
        mockUserId,
        UserRole.CUSTOMER,
      );

      expect(result).toBe(true);
    });

    it('should return false when user does not have required role', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.validateUserRole(
        mockTenantId,
        mockUserId,
        UserRole.ADMIN,
      );

      expect(result).toBe(false);
    });
  });

  describe('findAllUsers', () => {
    it('should return paginated users list', async () => {
      const mockUsers = [mockUser, { ...mockUser, id: 'user-456' }];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      const result = await service.findAllUsers(mockTenantId, {
        role: UserRole.CUSTOMER,
        skip: 0,
        take: 10,
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          role: UserRole.CUSTOMER,
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.users[0].tenantId).toBe(mockTenantId); // Admin response includes tenantId
    });
  });
});

/**
 * Test Design Principles:
 *
 * 1. **Isolation**: Each test is independent with mocked dependencies
 * 2. **Comprehensive Coverage**: Test happy path, edge cases, and errors
 * 3. **Realistic Data**: Use representative mock data
 * 4. **Clear Assertions**: Verify both behavior and data transformations
 * 5. **Error Scenarios**: Test all expected exception cases
 * 6. **Business Logic**: Focus on service logic, not framework code
 */
