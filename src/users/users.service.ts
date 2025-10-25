import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Assuming Prisma service exists
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto, AdminUserResponseDto } from './dto/user-response.dto';
import { User } from '@prisma/client';

/**
 * Users Service - Core business logic for user management
 * 
 * Key Features:
 * 1. Phone-based user upsert (create or update)
 * 2. Duplicate phone number handling
 * 3. Role-based access control
 * 4. Multi-tenant support
 * 5. Input validation and sanitization
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert user by phone number - Core functionality
   * 
   * Business Logic:
   * 1. If phone exists in tenant -> Update existing user
   * 2. If phone doesn't exist -> Create new user  
   * 3. Always return consistent user object
   * 4. Handle race conditions with proper error handling
   * 
   * @param tenantId - Multi-tenant isolation
   * @param userData - User creation/update data
   * @returns User object (created or updated)
   */
  async upsertUserByPhone(
    tenantId: string,
    userData: CreateUserDto,
  ): Promise<UserResponseDto> {
    try {
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
          // Update only provided fields (partial update)
          name: userData.name,
          email: userData.email || null,
          // Role can only be updated by admins (enforced at controller level)
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
   * Used for authentication and user lookup
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
   * Update existing user
   * Validates user exists and handles phone number changes carefully
   */
  async updateUser(
    tenantId: string,
    userId: string,
    updateData: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Verify user exists in tenant
    const existingUser = await this.findById(tenantId, userId);
    if (!existingUser) {
      throw new NotFoundException('User not found');
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
            id: { not: userId }, // Exclude current user
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
   * Supports pagination and filtering
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
   * Normalize phone number for consistent storage
   * Removes spaces, dashes, parentheses
   * Ensures consistent format: +91XXXXXXXXXX
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
   * Prevents orphaned users
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
   * Removes sensitive fields
   */
  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Convert Prisma User to admin UserResponseDto
   * Includes additional fields for admin view
   */
  private toAdminUserResponse(user: User): AdminUserResponseDto {
    return {
      ...this.toUserResponse(user),
      tenantId: user.tenantId,
    };
  }
}

/**
 * Service Design Principles:
 * 
 * 1. **Single Responsibility**: Each method has one clear purpose
 * 2. **Error Handling**: Proper exception throwing with meaningful messages
 * 3. **Data Validation**: Input sanitization and normalization
 * 4. **Multi-tenant Safety**: All operations scoped to tenantId
 * 5. **Atomic Operations**: Using Prisma transactions where needed
 * 6. **Performance**: Efficient queries with proper indexing
 * 7. **Security**: No sensitive data in responses
 */