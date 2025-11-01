/**
 * Admin Controller
 * 
 * REST endpoints for admin operations.
 * Phase5-T-037
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { UserRole } from '@/users/dto/create-user.dto';
import { AdminService } from './admin.service';
import { ApproveBookingDto, RejectBookingDto, RecordCashPaymentDto, AdminBookingFilterDto } from './dto/admin.dto';

/**
 * Admin API endpoints
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
@ApiTags('Admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get admin dashboard analytics
   * 
   * @param user Current authenticated user (must be admin)
   * @returns Analytics summary
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard analytics' })
  async getDashboard(@CurrentUser() user: any) {
    return this.adminService.getDashboardAnalytics(user.tenantId);
  }

  /**
   * Get booking for review
   * 
   * @param id Booking ID
   * @param user Current authenticated user
   * @returns Booking details for review
   */
  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get booking details for review' })
  async getBooking(@Param('id') id: string, @CurrentUser() user: any) {
    return this.adminService.getBookingForReview(user.tenantId, id);
  }

  /**
   * Approve a pending booking
   * 
   * @param id Booking ID
   * @param dto Approval data with optional notes
   * @param user Current authenticated user
   * @returns Updated booking
   */
  @Post('bookings/:id/approve')
  @ApiOperation({ summary: 'Approve a pending booking' })
  async approveBooking(
    @Param('id') id: string,
    @Body() dto: ApproveBookingDto,
    @CurrentUser() user: any
  ) {
    return this.adminService.approveBooking(user.tenantId, id, user.userId, dto);
  }

  /**
   * Reject a pending booking
   * 
   * @param id Booking ID
   * @param dto Rejection data with reason
   * @param user Current authenticated user
   * @returns Updated booking
   */
  @Post('bookings/:id/reject')
  @ApiOperation({ summary: 'Reject a pending booking' })
  async rejectBooking(
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser() user: any
  ) {
    return this.adminService.rejectBooking(user.tenantId, id, user.userId, dto);
  }

  /**
   * Record a cash payment
   * 
   * @param dto Payment data
   * @param user Current authenticated user
   * @returns Payment record
   */
  @Post('payments/cash')
  @ApiOperation({ summary: 'Record a cash payment' })
  async recordCashPayment(
    @Body() dto: RecordCashPaymentDto,
    @CurrentUser() user: any
  ) {
    return this.adminService.recordCashPayment(user.tenantId, user.userId, dto);
  }

  /**
   * List bookings with filters
   * 
   * @param filters Filter criteria
   * @param user Current authenticated user
   * @returns Filtered booking list
   */
  @Get('bookings')
  @ApiOperation({ summary: 'List bookings with filters' })
  async listBookings(
    @Query() filters: AdminBookingFilterDto,
    @CurrentUser() user: any
  ) {
    // TODO: Implement pagination and filtering
    return {
      data: [],
      total: 0,
      page: filters.page || 1,
      limit: filters.limit || 10,
    };
  }
}
