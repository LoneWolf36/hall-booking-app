import { Controller, Get, Post, Body, Param, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RedisService } from './redis.service';
import { RedisSetDto } from './dto/redis-set.dto';
import { CustomValidationPipe } from '../common/pipes/validation.pipe';

@ApiTags('Redis Test')
@Controller('redis-test')
export class RedisTestController {
  constructor(private readonly redisService: RedisService) {}

  @Get('health')
  @ApiOperation({ summary: 'Redis health check' })
  @ApiResponse({ status: 200, description: 'Redis health status' })
  async health() {
    return await this.redisService.healthCheck();
  }

  @Post('set/:key')
  @ApiOperation({ summary: 'Set a value in Redis with optional TTL' })
  @ApiBody({ type: RedisSetDto, examples: {
    'simple': {
      summary: 'Simple string value',
      value: { value: 'hello world' }
    },
    'with-ttl': {
      summary: 'Value with TTL',
      value: { value: 'hello world', ttl: 3600 }
    },
    'object': {
      summary: 'JSON object',
      value: { value: { name: 'John', age: 30 }, ttl: 1800 }
    }
  }})
  @ApiResponse({ status: 200, description: 'Value set successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @UsePipes(CustomValidationPipe)
  async setKey(
    @Param('key') key: string, 
    @Body() body: RedisSetDto
  ): Promise<{ success: boolean; key: string; message: string }> {
    try {
      await this.redisService.setJSON(key, body.value, body.ttl);
      return { 
        success: true, 
        key,
        message: `Value set for key '${key}'${body.ttl ? ` with TTL ${body.ttl}s` : ''}` 
      };
    } catch (error) {
      return {
        success: false,
        key,
        message: `Failed to set value: ${error.message}`
      };
    }
  }

  @Get('get/:key')
  @ApiOperation({ summary: 'Get a value from Redis' })
  @ApiResponse({ status: 200, description: 'Value retrieved successfully' })
  async getKey(@Param('key') key: string) {
    try {
      const value = await this.redisService.getJSON(key);
      return { 
        success: true,
        key, 
        value, 
        exists: value !== null 
      };
    } catch (error) {
      return {
        success: false,
        key,
        value: null,
        exists: false,
        message: `Failed to get value: ${error.message}`
      };
    }
  }

  @Post('test-booking-flow')
  @ApiOperation({ summary: 'Test booking idempotency flow' })
  @ApiResponse({ status: 200, description: 'Booking flow test completed' })
  async testBookingFlow() {
    const bookingId = `booking-${Date.now()}`;
    const idempotencyKey = `idempotency-${Date.now()}`;
    
    try {
      // Simulate booking creation with idempotency
      const existingBooking = await this.redisService.getJSON(`idempotency:${idempotencyKey}`);
      if (existingBooking) {
        return { 
          success: true,
          message: 'Duplicate request detected', 
          booking: existingBooking,
          fromCache: true
        };
      }

      // Simulate new booking
      const newBooking = {
        id: bookingId,
        venueId: 'venue-1',
        userId: 'user-1',
        status: 'temp_hold',
        createdAt: new Date().toISOString()
      };

      // Cache for 24 hours (86400 seconds)
      await this.redisService.setJSON(`idempotency:${idempotencyKey}`, newBooking, 86400);
      
      // Also cache booking details for quick lookup
      await this.redisService.setJSON(`booking:${bookingId}`, newBooking, 3600);

      return { 
        success: true,
        message: 'Booking created successfully', 
        booking: newBooking,
        fromCache: false
      };
    } catch (error) {
      return {
        success: false,
        message: `Booking flow test failed: ${error.message}`
      };
    }
  }

  @Post('delete/:key')
  @ApiOperation({ summary: 'Delete a key from Redis' })
  @ApiResponse({ status: 200, description: 'Key deleted successfully' })
  async deleteKey(@Param('key') key: string) {
    try {
      await this.redisService.del(key);
      return { 
        success: true, 
        key,
        message: `Key '${key}' deleted successfully` 
      };
    } catch (error) {
      return {
        success: false,
        key,
        message: `Failed to delete key: ${error.message}`
      };
    }
  }
}
