import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { VenuesService, CalculatePricingDto } from './venues.service';
import { VenuesService as VenuesServiceClass } from './venues.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/dto/auth-response.dto';

@ApiTags('venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesServiceClass) {}

  /**
   * GET /venues - List all venues
   */
  @Get()
  @ApiOperation({ summary: 'List venues', description: 'Get all venues for the tenant' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Venues retrieved successfully' })
  async listVenues(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('isActive') isActive?: string,
  ) {
    const result = await this.venuesService.listVenues(user.tenantId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      isActive: isActive === 'true',
    });

    return {
      success: true,
      data: result.venues,
      meta: { total: result.total },
    };
  }

  /**
   * GET /venues/:id - Get venue by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get venue', description: 'Get venue details by ID' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiResponse({ status: 200, description: 'Venue retrieved successfully' })
  async getVenue(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
  ) {
    const venue = await this.venuesService.getVenue(user.tenantId, venueId);

    return {
      success: true,
      data: venue,
    };
  }

  /**
   * POST /venues/calculate-pricing - Calculate pricing for selected dates
   */
  @Post('calculate-pricing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Calculate pricing', 
    description: 'Calculate variable pricing for selected dates with weekend, Sunday, seasonal, and surge multipliers' 
  })
  @ApiResponse({ status: 200, description: 'Pricing calculated successfully' })
  async calculatePricing(
    @Body() dto: CalculatePricingDto,
  ) {
    const result = await this.venuesService.calculatePricing(dto);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /venues/:id/pricing - Get venue pricing configuration
   */
  @Get(':id/pricing')
  @ApiOperation({ summary: 'Get pricing config', description: 'Get venue pricing configuration including GST' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiResponse({ status: 200, description: 'Pricing config retrieved successfully' })
  async getVenuePricingConfig(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
  ) {
    const config = await this.venuesService.getVenuePricingConfig(user.tenantId, venueId);

    return {
      success: true,
      data: config,
    };
  }

  /**
   * PATCH /venues/:id/pricing - Update venue pricing configuration
   */
  @Patch(':id/pricing')
  @ApiOperation({ summary: 'Update pricing config', description: 'Update venue pricing configuration (admin only)' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiResponse({ status: 200, description: 'Pricing config updated successfully' })
  async updateVenuePricingConfig(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
    @Body() pricingUpdates: any,
  ) {
    const updated = await this.venuesService.updateVenuePricingConfig(user.tenantId, venueId, pricingUpdates);

    return {
      success: true,
      data: updated,
      message: 'Pricing configuration updated successfully',
    };
  }

  /**
   * GET /venues/:id/furniture - Get furniture options
   */
  @Get(':id/furniture')
  @ApiOperation({ summary: 'Get furniture options', description: 'Get furniture pricing options for venue' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiResponse({ status: 200, description: 'Furniture options retrieved successfully' })
  async getFurnitureOptions(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
  ) {
    const furniture = await this.venuesService.getFurnitureOptions(user.tenantId, venueId);

    return {
      success: true,
      data: furniture,
    };
  }

  /**
   * POST /venues/:id/furniture - Add furniture option
   */
  @Post(':id/furniture')
  @ApiOperation({ summary: 'Add furniture option', description: 'Add furniture pricing option to venue (admin only)' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiResponse({ status: 201, description: 'Furniture option added successfully' })
  async addFurnitureOption(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
    @Body() furnitureData: any,
  ) {
    const furniture = await this.venuesService.addFurnitureOption(user.tenantId, venueId, furnitureData);

    return {
      success: true,
      data: furniture,
      message: 'Furniture option added successfully',
    };
  }

  /**
   * PATCH /venues/:id/furniture/:furnitureId - Update furniture option
   */
  @Patch(':id/furniture/:furnitureId')
  @ApiOperation({ summary: 'Update furniture option', description: 'Update furniture pricing option (admin only)' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiParam({ name: 'furnitureId', description: 'Furniture option ID' })
  @ApiResponse({ status: 200, description: 'Furniture option updated successfully' })
  async updateFurnitureOption(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
    @Param('furnitureId') furnitureId: string,
    @Body() updates: any,
  ) {
    const furniture = await this.venuesService.updateFurnitureOption(user.tenantId, venueId, furnitureId, updates);

    return {
      success: true,
      data: furniture,
      message: 'Furniture option updated successfully',
    };
  }

  /**
   * GET /venues/:id/contacts - Get venue contacts
   */
  @Get(':id/contacts')
  @ApiOperation({ summary: 'Get venue contacts', description: 'Get delegated service contacts for venue' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Contacts retrieved successfully' })
  async getVenueContacts(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
    @Query('category') category?: string,
  ) {
    const contacts = await this.venuesService.getVenueContacts(user.tenantId, venueId, category);

    return {
      success: true,
      data: contacts,
    };
  }

  /**
   * POST /venues/:id/contacts - Add venue contact
   */
  @Post(':id/contacts')
  @ApiOperation({ summary: 'Add venue contact', description: 'Add delegated service contact to venue (admin only)' })
  @ApiParam({ name: 'id', description: 'Venue UUID' })
  @ApiResponse({ status: 201, description: 'Contact added successfully' })
  async addVenueContact(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) venueId: string,
    @Body() contactData: any,
  ) {
    const contact = await this.venuesService.addVenueContact(user.tenantId, venueId, contactData);

    return {
      success: true,
      data: contact,
      message: 'Contact added successfully',
    };
  }
}
