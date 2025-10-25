import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto, AdminUserResponseDto } from './dto/user-response.dto';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Future: Authentication
// import { RolesGuard } from '../auth/roles.guard'; // Future: Authorization
// import { Roles } from '../auth/roles.decorator'; // Future: Role decorator

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
@Controller('api/v1/users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /api/v1/users - Create or update user by phone
   * 
   * This is the main upsert endpoint:
   * - If phone exists: updates the existing user
   * - If phone doesn't exist: creates new user
   * 
   * Headers Required:
   * - X-Tenant-Id: Tenant identifier (for multi-tenancy)
   * 
   * Business Logic:
   * - Only admins can set role other than 'customer'
   * - Phone numbers are automatically normalized
   * - Email is optional for Indian market
   */
  @Post()
  @HttpCode(HttpStatus.OK) // 200 for both create/update (upsert pattern)
  async upsertUser(
    @Request() req: any, // Future: Extract from JWT token
    @Body(ValidationPipe) createUserDto: CreateUserDto,
  ): Promise<{
    success: boolean;
    data: UserResponseDto;
    message: string;
  }> {
    // TODO: Extract tenantId from JWT token when auth is implemented
    // For now, get from header (temporary for development)
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // TODO: Check if current user is admin for role assignment
    // const currentUser = req.user;
    // if (createUserDto.role === UserRole.ADMIN && currentUser.role !== UserRole.ADMIN) {
    //   throw new ForbiddenException('Only admins can create admin users');
    // }

    const user = await this.usersService.upsertUserByPhone(tenantId, createUserDto);
    
    return {
      success: true,
      data: user,
      message: 'User created or updated successfully',
    };
  }

  /**
   * GET /api/v1/users/phone/:phone - Find user by phone number
   * 
   * Use Cases:
   * - Login by phone number
   * - Check if user exists during booking
   * - Customer lookup for support
   */
  @Get('phone/:phone')
  async findByPhone(
    @Request() req: any,
    @Param('phone') phone: string,
  ): Promise<{
    success: boolean;
    data: UserResponseDto | null;
  }> {
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const user = await this.usersService.findByPhone(tenantId, phone);
    
    return {
      success: true,
      data: user,
    };
  }

  /**
   * GET /api/v1/users/:id - Find user by ID
   * 
   * Use Cases:
   * - Get user profile
   * - User details for booking confirmation
   * - Admin user management
   */
  @Get(':id')
  async findById(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{
    success: boolean;
    data: UserResponseDto | null;
  }> {
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
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
   * PATCH /api/v1/users/:id - Update existing user
   * 
   * Use Cases:
   * - Update user profile
   * - Change email/phone
   * - Admin role management
   * 
   * Future: Add authentication check for self-update or admin role
   */
  @Patch(':id')
  async updateUser(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ): Promise<{
    success: boolean;
    data: UserResponseDto;
    message: string;
  }> {
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // TODO: Add authorization check
    // const currentUser = req.user;
    // if (currentUser.id !== id && currentUser.role !== UserRole.ADMIN) {
    //   throw new ForbiddenException('You can only update your own profile');
    // }

    const user = await this.usersService.updateUser(tenantId, id, updateUserDto);
    
    return {
      success: true,
      data: user,
      message: 'User updated successfully',
    };
  }

  /**
   * GET /api/v1/users - List all users (Admin only)
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
  // @UseGuards(JwtAuthGuard, RolesGuard) // Future: Add authentication
  // @Roles(UserRole.ADMIN) // Future: Admin only access
  async findAll(
    @Request() req: any,
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
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

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
   * GET /api/v1/users/:id/validate-role/:role - Validate user role
   * 
   * Use Cases:
   * - Check admin permissions
   * - Role-based feature access
   * - Authorization middleware
   */
  @Get(':id/validate-role/:role')
  async validateRole(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role') role: UserRole,
  ): Promise<{
    success: boolean;
    data: { hasRole: boolean };
  }> {
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const hasRole = await this.usersService.validateUserRole(tenantId, id, role);
    
    return {
      success: true,
      data: { hasRole },
    };
  }
}

/**
 * Controller Design Decisions:
 * 
 * 1. **Consistent Response Format**: All endpoints return { success, data, message? }
 * 2. **Proper HTTP Status Codes**: 200 for success, 201 for creation, 404 for not found
 * 3. **Input Validation**: Using DTOs with class-validator
 * 4. **Error Handling**: Proper HTTP exceptions with meaningful messages
 * 5. **Multi-tenant Support**: Tenant ID from header (future: JWT token)
 * 6. **Pagination**: Standard offset-based pagination
 * 7. **Security**: Prepared for future authentication/authorization
 * 8. **OpenAPI Ready**: Swagger documentation friendly
 */