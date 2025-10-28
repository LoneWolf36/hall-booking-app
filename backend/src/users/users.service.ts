import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from '../common/services/validation.service';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto, AdminUserResponseDto } from './dto/user-response.dto';
import { ERROR_MESSAGES } from '../common/constants/app.constants';

// Define minimal user type to avoid Prisma client export issues
type MinimalUser = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Users Service - Handles user management with phone-based identity
 *
 * Features:
 * - Phone-based user upsert (creates or updates by phone number)
 * - Multi-tenant user isolation
 * - Phone number normalization for Indian market (+91 prefix)
 * - Role-based user management (customer, admin, staff)
 * - Centralized validation using ValidationService
 *
 * Phone Normalization:
 * - Strips all non-digit characters except +
 * - Automatically adds +91 prefix for 10-digit Indian numbers
 * - Ensures consistent storage format: +919876543210
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * Upsert user by phone number - creates new or updates existing user.
   *
   * This is the primary method for user management in the booking flow.
   * Supports anonymous bookings where only phone and name are required.
   *
   * **Upsert Behavior**:
   * - If phone exists in tenant: Updates name, email, and optionally role
   * - If phone doesn't exist: Creates new user with customer role (default)
   * - Phone number is normalized to +91XXXXXXXXXX format
   *
   * **Database Operation**:
   * - Uses Prisma's atomic `upsert` operation
   * - Unique constraint: (tenantId, phone) ensures one user per phone per tenant
   * - Prevents duplicate phone numbers across tenants
   *
   * **Validation**:
   * - Name: Max 100 characters (via ValidationService)
   * - Phone: Max 20 characters, auto-normalized (via ValidationService)
   * - Email: Optional, max 255 characters if provided
   * - Role: Defaults to 'customer' if not specified
   *
   * @param tenantId - Tenant UUID for multi-tenant isolation
   * @param userData - User creation/update data:
   *   - name: Full name (required)
   *   - phone: Phone number in any format, will be normalized (required)
   *   - email: Optional email address
   *   - role: Optional role (defaults to 'customer')
   *
   * @returns UserResponseDto with sanitized user data (no sensitive fields)
   *
   * @throws {BadRequestException} - Invalid tenant, phone, name, or email format
   * @throws {ConflictException} - Phone already exists in different tenant (edge case)
   *
   * @example
   * ```typescript
   * const user = await usersService.upsertUserByPhone(tenantId, {
   *   name: 'Rahul Sharma',
   *   phone: '9876543210',  // Will be normalized to +919876543210
   *   email: 'rahul@example.com',
   *   role: UserRole.CUSTOMER
   * });
   * ```
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
        throw new ConflictException(
          'Phone number already exists in another tenant',
        );
      }
      throw error;
    }
  }

  /**
   * Find user by phone number within tenant scope.
   *
   * Phone number is normalized before lookup to ensure consistent matching.
   *
   * @param tenantId - Tenant UUID for data isolation
   * @param phone - Phone number in any format (will be normalized)
   *
   * @returns UserResponseDto if found, null otherwise
   *
   * @throws Never throws - returns null for not found
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
   * Find user by UUID within tenant scope.
   *
   * Used for:
   * - Booking creation when userId is provided
   * - User profile retrieval
   * - Admin user management
   *
   * @param tenantId - Tenant UUID for multi-tenant isolation
   * @param userId - User UUID
   *
   * @returns UserResponseDto if found and belongs to tenant, null otherwise
   *
   * @throws Never throws - returns null for not found
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
   * Update existing user's information.
   *
   * **Validation**:
   * - User must exist in tenant (throws NotFoundException)
   * - Phone number changes checked for conflicts
   * - All fields validated using centralized ValidationService
   *
   * **Updatable Fields**:
   * - name: User's full name
   * - email: Email address (can be set to null)
   * - phone: Phone number (normalized, checked for uniqueness)
   * - role: User role (admin, customer, staff)
   *
   * **Phone Update Logic**:
   * - If phone is being changed, checks for conflicts with other users
   * - Normalizes new phone number before update
   * - Throws ConflictException if new phone already exists
   *
   * @param tenantId - Tenant UUID
   * @param userId - UUID of user to update
   * @param updateData - Partial user data to update
   *
   * @returns Updated UserResponseDto
   *
   * @throws {NotFoundException} - User doesn't exist in tenant
   * @throws {BadRequestException} - Invalid field values
   * @throws {ConflictException} - New phone number already exists
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
        ...(updateData.email !== undefined && {
          email: updateData.email || null,
        }),
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
          throw new ConflictException(
            'Phone number already exists for another user',
          );
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
   * List all users for admin interface with pagination and filtering.
   *
   * **Query Options**:
   * - role: Filter by user role (customer, admin, staff)
   * - skip: Number of records to skip (for pagination)
   * - take: Number of records to return (max 50 per request)
   *
   * **Use Cases**:
   * - Admin user management dashboard
   * - Customer support user lookup
   * - Analytics and reporting
   *
   * @param tenantId - Tenant UUID for data isolation
   * @param options - Query options:
   *   - role: Optional role filter
   *   - skip: Offset for pagination (default: 0)
   *   - take: Limit for pagination (default: 50, max: 50)
   *
   * @returns Object containing:
   *   - users: Array of AdminUserResponseDto (includes tenantId)
   *   - total: Total count of users matching filter
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
   * Validate that user has specific role (used for authorization checks).
   *
   * **Future Use**:
   * - RolesGuard implementation
   * - Admin-only endpoint protection
   * - Feature flag checks
   *
   * @param tenantId - Tenant UUID
   * @param userId - User UUID to check
   * @param requiredRole - Role to validate against
   *
   * @returns true if user exists and has the required role, false otherwise
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
   * Validate user input fields using centralized ValidationService.
   *
   * Validates:
   * - name: Not empty, max 100 characters
   * - phone: Valid format, max 20 characters
   * - email: Valid format if provided, max 255 characters
   *
   * @param userData - User data to validate
   *
   * @throws {BadRequestException} - If any field validation fails
   *
   * @private
   */
  private validateUserInput(userData: CreateUserDto): void {
    this.validationService.validateCustomerName(userData.name);
    this.validationService.validatePhoneNumber(userData.phone);
    this.validationService.validateEmail(userData.email);
  }

  /**
   * Normalize phone number to consistent storage format.
   *
   * **Normalization Rules**:
   * 1. Remove all non-digit characters except +
   * 2. If 10 digits without prefix, add +91 (Indian country code)
   * 3. Keep international format as-is if + prefix already present
   *
   * Examples:
   * - "9876543210" → "+919876543210"
   * - "98765-43210" → "+919876543210"
   * - "+919876543210" → "+919876543210" (no change)
   * - "+12025551234" → "+12025551234" (international, no change)
   *
   * @param phone - Phone number in any format
   *
   * @returns Normalized phone number in E.164 format
   *
   * @private
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
   * Validate that tenant exists in database.
   *
   * **Purpose**: Prevent orphaned users in non-existent tenants
   *
   * @param tenantId - Tenant UUID to validate
   *
   * @throws {BadRequestException} - If tenant doesn't exist
   *
   * @private
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
   * Transform Prisma User entity to public UserResponseDto.
   *
   * Sanitizes user data for API responses by:
   * - Converting null email to undefined
   * - Omitting internal database fields
   * - Ensuring consistent date formatting
   *
   * @param user - Raw Prisma user entity
   *
   * @returns UserResponseDto safe for external API responses
   *
   * @private
   */
  private toUserResponse(user: MinimalUser): UserResponseDto {
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
   * Transform Prisma User entity to admin UserResponseDto.
   *
   * Includes additional fields for admin interfaces:
   * - tenantId: For multi-tenant management
   *
   * Extends base UserResponseDto with admin-specific data.
   *
   * @param user - Raw Prisma user entity
   *
   * @returns AdminUserResponseDto with tenant information
   *
   * @private
   */
  private toAdminUserResponse(user: MinimalUser): AdminUserResponseDto {
    return {
      ...this.toUserResponse(user),
      tenantId: user.tenantId,
    };
  }
}
