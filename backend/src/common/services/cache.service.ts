import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Centralized Cache Service - Unified caching operations
 * 
 * This service consolidates all caching logic to eliminate duplication
 * across the application and provide consistent cache key patterns.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generic cache set with TTL
   */
  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redisService.setJSON(key, data, ttlSeconds);
    } catch (error) {
      this.logger.warn(`Failed to cache data for key: ${key}`, error);
    }
  }

  /**
   * Generic cache get with type safety
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.redisService.getJSON<T>(key);
    } catch (error) {
      this.logger.warn(`Failed to get cached data for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Generic cache delete
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
    } catch (error) {
      this.logger.warn(`Failed to delete cached data for key: ${key}`, error);
    }
  }

  /**
   * Alias for delete method to match Redis interface expectations
   * This is used by payments services that call cacheService.del()
   */
  async del(key: string): Promise<void> {
    return this.delete(key);
  }

  /**
   * Cache booking with standardized key pattern
   */
  async cacheBooking(booking: any, ttlSeconds: number = 3600): Promise<void> {
    const cacheKey = `booking:${booking.id}`;
    await this.set(cacheKey, booking, ttlSeconds);
  }

  /**
   * Get cached booking
   */
  async getCachedBooking(bookingId: string): Promise<any> {
    const cacheKey = `booking:${bookingId}`;
    return await this.get(cacheKey);
  }

  /**
   * Cache availability with standardized key pattern
   */
  async cacheAvailability(
    tenantId: string,
    venueId: string,
    startTs: string,
    endTs: string,
    availability: any,
    ttlSeconds: number = 300
  ): Promise<void> {
    const cacheKey = `availability:${tenantId}:${venueId}:${startTs}:${endTs}`;
    await this.set(cacheKey, availability, ttlSeconds);
  }

  /**
   * Get cached availability
   */
  async getCachedAvailability(
    tenantId: string,
    venueId: string,
    startTs: string,
    endTs: string
  ): Promise<any> {
    const cacheKey = `availability:${tenantId}:${venueId}:${startTs}:${endTs}`;
    return await this.get(cacheKey);
  }

  /**
   * Invalidate booking-related cache
   */
  async invalidateBookingCache(bookingId: string): Promise<void> {
    try {
      const cacheKey = `booking:${bookingId}`;
      await this.redisService.del(cacheKey);
    } catch (error) {
      this.logger.warn(`Failed to invalidate booking cache: ${bookingId}`, error);
    }
  }
}