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

/**
 * Users Controller - REST API endpoints for user management
 */
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users - Create or update user by phone
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async upsertUser(
    @Request() req: any,
    @Body(ValidationPipe) createUserDto: CreateUserDto,
  ): Promise<{ success: boolean; data: UserResponseDto; message: string; }> {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const user = await this.usersService.upsertUserByPhone(tenantId, createUserDto);
    return { success: true, data: user, message: 'User created or updated successfully' };
  }

  /**
   * GET /users/phone/:phone - Find user by phone number
   */
  @Get('phone/:phone')
  async findByPhone(
    @Request() req: any,
    @Param('phone') phone: string,
  ): Promise<{ success: boolean; data: UserResponseDto | null; }> {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const user = await this.usersService.findByPhone(tenantId, phone);
    return { success: true, data: user };
  }

  /**
   * GET /users/:id - Find user by ID
   */
  @Get(':id')
  async findById(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; data: UserResponseDto | null; }> {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const user = await this.usersService.findById(tenantId, id);
    if (!user) throw new NotFoundException('User not found');

    return { success: true, data: user };
  }

  /**
   * PATCH /users/:id - Update existing user
   */
  @Patch(':id')
  async updateUser(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ): Promise<{ success: boolean; data: UserResponseDto; message: string; }> {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const user = await this.usersService.updateUser(tenantId, id, updateUserDto);
    return { success: true, data: user, message: 'User updated successfully' };
  }

  /**
   * GET /users - List all users (Admin only)
   */
  @Get()
  async findAll(
    @Request() req: any,
    @Query('role') role?: UserRole,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; data: AdminUserResponseDto[]; pagination: { page: number; limit: number; total: number; totalPages: number; }; }> {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const pageNum = parseInt(page ?? '1', 10) || 1;
    const pageSize = Math.min(parseInt(limit ?? '20', 10) || 20, 100);
    const skip = (pageNum - 1) * pageSize;

    const result = await this.usersService.findAllUsers(tenantId, { role, skip, take: pageSize });
    return {
      success: true,
      data: result.users,
      pagination: { page: pageNum, limit: pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) },
    };
  }

  /**
   * GET /users/:id/validate-role/:role - Validate user role
   */
  @Get(':id/validate-role/:role')
  async validateRole(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role') role: UserRole,
  ): Promise<{ success: boolean; data: { hasRole: boolean }; }> {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const hasRole = await this.usersService.validateUserRole(tenantId, id, role);
    return { success: true, data: { hasRole } };
  }
}
