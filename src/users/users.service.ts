import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from '../common/services/validation.service';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto, AdminUserResponseDto } from './dto/user-response.dto';
import { User } from '@prisma/client';
import { ERROR_MESSAGES } from '../common/constants/app.constants';

/**
 * Users Service - Refactored to use centralized validation
 * 
 * Now uses:
 * - ValidationService for consistent field validation
 * - Centralized constants from app.constants.ts
 * - Eliminates duplicate validation logic
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * Upsert user by phone number using centralized validation
   */
  async upsertUserByPhone(
    tenantId: string,
    userData: CreateUserDto,
  ): Promise<UserResponseDto> {
    try {
      // Validate input fields using centralized validation
      this.validateUserInput(userData);
      
      // Normalize phone number for consistent storage
      const normalizedPhone = this.normalizePhoneNumber(userData.phone);
      
      // Validate tenant exists
      await this.validateTenantExists(tenantId);
      
      // Attempt upsert using Prisma's atomic operation
      const user = await this.prisma.user.upsert({
        where: {
          tenantId_phone: {
            tenantId,
            phone: normalizedPhone,
          },
        },
        update: {
          name: userData.name,
          email: userData.email || null,
          ...(userData.role && { role: userData.role }),
        },
        create: {
          tenantId,
          name: userData.name,
          phone: normalizedPhone,
          email: userData.email || null,
          role: userData.role || UserRole.CUSTOMER,
        },
      });
      
      return this.toUserResponse(user);
    } catch (error) {
      // Handle specific Prisma errors
      if (error.code === 'P2002') {
        throw new ConflictException('Phone number already exists in another tenant');
      }
      throw error;
    }
  }

  /**
   * Find user by phone number within tenant
   */
  async findByPhone(
    tenantId: string,
    phone: string,
  ): Promise<UserResponseDto | null> {
    const normalizedPhone = this.normalizePhoneNumber(phone);
    
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_phone: {
          tenantId,
          phone: normalizedPhone,
        },
      },
    });
    
    return user ? this.toUserResponse(user) : null;
  }

  /**
   * Find user by ID within tenant
   */
  async findById(
    tenantId: string,
    userId: string,
  ): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });
    
    return user ? this.toUserResponse(user) : null;
  }

  /**
   * Update existing user using centralized validation
   */
  async updateUser(
    tenantId: string,
    userId: string,
    updateData: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Verify user exists in tenant
    const existingUser = await this.findById(tenantId, userId);
    if (!existingUser) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    
    // Validate input fields using centralized validation
    if (updateData.name) {
      this.validationService.validateCustomerName(updateData.name);
    }
    if (updateData.email) {
      this.validationService.validateEmail(updateData.email);
    }
    if (updateData.phone) {
      this.validationService.validatePhoneNumber(updateData.phone);
    }
    
    try {
      const updatePayload: any = {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.email !== undefined && { email: updateData.email || null }),
        ...(updateData.role && { role: updateData.role }),
      };
      
      // Handle phone number changes carefully
      if (updateData.phone) {
        const normalizedPhone = this.normalizePhoneNumber(updateData.phone);
        
        // Check if new phone already exists (for different user)
        const phoneExists = await this.prisma.user.findFirst({
          where: {
            tenantId,
            phone: normalizedPhone,
            id: { not: userId },
          },
        });
        
        if (phoneExists) {
          throw new ConflictException('Phone number already exists for another user');
        }
        
        updatePayload.phone = normalizedPhone;
      }
      
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload,
      });
      
      return this.toUserResponse(updatedUser);
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Phone number already exists');
      }
      throw error;
    }
  }

  /**
   * List users for admin interface
   */
  async findAllUsers(
    tenantId: string,
    options: {
      role?: UserRole;
      skip?: number;
      take?: number;
    } = {},
  ): Promise<{ users: AdminUserResponseDto[]; total: number }> {
    const { role, skip = 0, take = 50 } = options;
    
    const where = {
      tenantId,
      ...(role && { role }),
    };
    
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    
    return {
      users: users.map(this.toAdminUserResponse),
      total,
    };
  }

  /**
   * Validate user role for authorization
   */
  async validateUserRole(
    tenantId: string,
    userId: string,
    requiredRole: UserRole,
  ): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        role: requiredRole,
      },
    });
    
    return !!user;
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Validate user input using centralized ValidationService
   */
  private validateUserInput(userData: CreateUserDto): void {
    this.validationService.validateCustomerName(userData.name);
    this.validationService.validatePhoneNumber(userData.phone);
    this.validationService.validateEmail(userData.email);
  }

  /**
   * Normalize phone number for consistent storage
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');
    
    // Add +91 if not present and number is 10 digits
    if (!normalized.startsWith('+91') && normalized.length === 10) {
      normalized = `+91${normalized}`;
    }
    
    return normalized;
  }

  /**
   * Validate tenant exists
   */
  private async validateTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    
    if (!tenant) {
      throw new BadRequestException('Invalid tenant');
    }
  }

  /**
   * Convert Prisma User to public UserResponseDto
   */
  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email ?? undefined,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Convert Prisma User to admin UserResponseDto
   */
  private toAdminUserResponse(user: User): AdminUserResponseDto {
    return {
      ...this.toUserResponse(user),
      tenantId: user.tenantId,
    };
  }
}