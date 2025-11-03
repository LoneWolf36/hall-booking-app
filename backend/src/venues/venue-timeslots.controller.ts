import { Controller, Get, Patch, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { VenuesService } from './venues.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { UserRole } from '../users/dto/create-user.dto';

// DTOs for timeslot config
export type VenueTimeslotMode = 'full_day' | 'fixed_sessions' | 'custom';
export interface VenueSessionDto {
  id: string; // e.g., morning, evening
  label: string;
  start: string; // HH:mm
  end: string;   // HH:mm
  priceMultiplier?: number; // optional
  active?: boolean;
}
export interface VenueTimeslotsDto {
  mode: VenueTimeslotMode;
  sessions: VenueSessionDto[];
}

@ApiTags('venues-timeslots')
@Controller('venues')
export class VenueTimeslotsController {
  constructor(private readonly venuesService: VenuesService) {}

  @Public()
  @Get(':id/timeslots')
  @ApiOperation({ summary: 'Get venue timeslot config' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  async getTimeslots(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) venueId: string,
  ) {
    const config = await this.venuesService.getVenueTimeslots(user?.tenantId, venueId);
    return { success: true, data: config };
  }

  @Patch(':id/timeslots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update venue timeslot config (admin)' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  async updateTimeslots(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) venueId: string,
    @Body() dto: VenueTimeslotsDto,
  ) {
    const updated = await this.venuesService.updateVenueTimeslots(user.tenantId, venueId, dto);
    return { success: true, data: updated, message: 'Timeslot configuration updated successfully' };
  }
}
