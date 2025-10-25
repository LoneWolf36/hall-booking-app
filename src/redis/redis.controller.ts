import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RedisService } from './redis.service';

@Controller('redis-test')
export class RedisTestController {
  constructor(private readonly redisService: RedisService) {}

  @Get('health')
  async health() {
    return await this.redisService.healthCheck();
  }

  @Post('set/:key')
  async setKey(@Param('key') key: string, @Body() body: { value: any; ttl?: number }) {
    await this.redisService.setJSON(key, body.value, body.ttl);
    return { success: true, key };
  }

  @Get('get/:key')
  async getKey(@Param('key') key: string) {
    const value = await this.redisService.getJSON(key);
    return { key, value, exists: value !== null };
  }

  @Post('test-booking-flow')
  async testBookingFlow() {
    const bookingId = 'booking-123';
    const idempotencyKey = 'idempotency-456';
    
    // Simulate booking creation with idempotency
    const existingBooking = await this.redisService.getJSON(`idempotency:${idempotencyKey}`);
    if (existingBooking) {
      return { message: 'Duplicate request', booking: existingBooking };
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

    return { message: 'Booking created', booking: newBooking };
  }

  // Create a delete endpoint to delete a key
  @Post('delete/:key')
  async deleteKey(@Param('key') key: string) {
    await this.redisService.del(key);
    return { success: true, key };
  }
}
