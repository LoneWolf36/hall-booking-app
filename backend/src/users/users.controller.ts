import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UseInterceptors,
  UseGuards,
  ClassSerializerInterceptor,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto, AdminUserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/dto/auth-response.dto';

/**
 * Users Controller - REST API endpoints for user management
 *
 * API Design Principles:
 * 1. RESTful routes following OpenAPI standards
 * 2. Proper HTTP status codes
 * 3. Input validation using DTOs
 * 4. Role-based access control (future)
 * 5. Tenant isolation in all operations
 * 6. Consistent error handling
 */
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users - Create or update user by phone
   *
   * This is the main upsert endpoint:
   * - If phone exists: updates the existing user
   * - If phone doesn't exist: creates new user
   *
   * Business Logic:
   * - Only admins can set role other than 'customer'
   * - Phone numbers are automatically normalized
   * - Email is optional for Indian market
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK) // 200 for both create/update (upsert pattern)
  async upsertUser(
    @CurrentUser() currentUser: RequestUser,
    @Body(ValidationPipe) createUserDto: CreateUserDto,
  ): Promise<{
    success: boolean;
    data: UserResponseDto;
    message: string;
  }> {
    const tenantId = currentUser.tenantId;

    // Only admins can set role other than 'customer'
    if (createUserDto.role && createUserDto.role !== UserRole.CUSTOMER) {
      if (currentUser.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only admins can create non-customer users');
      }
    }

    const user = await this.usersService.upsertUserByPhone(
      tenantId,
      createUserDto,
    );

    return {
      success: true,
      data: user,
      message: 'User created or updated successfully',
    };
  }

  /**
   * GET /users/phone/:phone - Find user by phone number
   *
   * Use Cases:
   * - Login by phone number
   * - Check if user exists during booking
   * - Customer lookup for support
   */
  @Get('phone/:phone')
  @UseGuards(JwtAuthGuard)
  async findByPhone(
    @CurrentUser() currentUser: RequestUser,
    @Param('phone') phone: string,
  ): Promise<{
    success: boolean;
    data: UserResponseDto | null;
  }> {
    const tenantId = currentUser.tenantId;

    const user = await this.usersService.findByPhone(tenantId, phone);

    return {
      success: true,
      data: user,
    };
  }

  /**
   * GET /users/:id - Find user by ID
   *
   * Use Cases:
   * - Get user profile
   * - User details for booking confirmation
   * - Admin user management
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(
    @CurrentUser() currentUser: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{
    success: boolean;
    data: UserResponseDto | null;
  }> {
    const tenantId = currentUser.tenantId;

    // Users can only view their own profile unless they're admin
    if (currentUser.userId !== id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only view your own profile');
    }

    const user = await this.usersService.findById(tenantId, id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: user,
    };
  }

  /**
   * PATCH /users/:id - Update existing user
   *
   * Use Cases:
   * - Update user profile
   * - Change email/phone
   * - Admin role management
   *
   * Authorization: Users can only update their own profile, admins can update any user.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @CurrentUser() currentUser: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ): Promise<{
    success: boolean;
    data: UserResponseDto;
    message: string;
  }> {
    const tenantId = currentUser.tenantId;

    // Users can only update their own profile unless they're admin
    if (currentUser.userId !== id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Only admins can change roles
    if (updateUserDto.role && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can change user roles');
    }

    const user = await this.usersService.updateUser(
      tenantId,
      id,
      updateUserDto,
    );

    return {
      success: true,
      data: user,
      message: 'User updated successfully',
    };
  }

  /**
   * GET /users - List all users (Admin only)
   *
   * Query Parameters:
   * - role: Filter by user role
   * - page: Page number (1-based)
   * - limit: Results per page
   *
   * Use Cases:
   * - Admin user management
   * - Customer support
   * - Analytics and reporting
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @CurrentUser() currentUser: RequestUser,
    @Query('role') role?: UserRole,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    success: boolean;
    data: AdminUserResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const tenantId = currentUser.tenantId;

    // Pagination setup
    const pageNum = parseInt(page ?? '1', 10) || 1;
    const pageSize = Math.min(parseInt(limit ?? '20', 10) || 20, 100); // Max 100 items per page
    const skip = (pageNum - 1) * pageSize;

    const result = await this.usersService.findAllUsers(tenantId, {
      role,
      skip,
      take: pageSize,
    });

    return {
      success: true,
      data: result.users,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    };
  }

  /**
   * GET /users/:id/validate-role/:role - Validate user role
   *
   * Use Cases:
   * - Check admin permissions
   * - Role-based feature access
   * - Authorization middleware
   */
  @Get(':id/validate-role/:role')
  @UseGuards(JwtAuthGuard)
  async validateRole(
    @CurrentUser() currentUser: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role') role: UserRole,
  ): Promise<{
    success: boolean;
    data: { hasRole: boolean };
  }> {
    const tenantId = currentUser.tenantId;

    const hasRole = await this.usersService.validateUserRole(
      tenantId,
      id,
      role,
    );

    return {
      success: true,
      data: { hasRole },
    };
  }
}

/**
 * Controller Design Decisions:
 *
 * 1. **JWT Authentication**: All endpoints protected with JwtAuthGuard
 * 2. **Role-Based Access**: Admin-only endpoints use @Roles(UserRole.ADMIN)
 * 3. **Tenant Isolation**: TenantId extracted from JWT token (req.user.tenantId)
 * 4. **Authorization Logic**:
 *    - Users can view/update their own profile
 *    - Admins can view/update any user
 *    - Only admins can create admin users or change roles
 * 5. **Consistent Response Format**: All endpoints return { success, data, message? }
 * 6. **Proper HTTP Status Codes**: 200 for success, 201 for creation, 403 for forbidden, 404 for not found
 * 7. **Input Validation**: Using DTOs with class-validator
 * 8. **Error Handling**: Proper HTTP exceptions with meaningful messages
 */
