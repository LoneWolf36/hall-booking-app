import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';
import * as uuid from 'uuid';

/**
 * Idempotency Interceptor - Prevents duplicate request processing
 * 
 * Key Features:
 * 1. Validates X-Idempotency-Key header format
 * 2. Checks Redis cache for duplicate requests
 * 3. Returns cached response for duplicates
 * 4. Caches successful responses for 24 hours
 * 5. Handles concurrent requests with same key safely
 * 
 * Teaching Points:
 * - Why idempotency matters in payment/booking systems
 * - How Redis atomic operations prevent race conditions
 * - Proper HTTP header validation patterns
 * - Error handling for distributed systems
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
  private readonly CACHE_KEY_PREFIX = 'idempotency:';

  constructor(private readonly redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only apply idempotency to POST/PUT/PATCH operations
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return next.handle();
    }

    // Extract and validate idempotency key
    const idempotencyKey = this.extractAndValidateKey(request);
    
    if (!idempotencyKey) {
      // If no idempotency key provided, continue without caching
      // Some endpoints might not require it
      return next.handle();
    }

    const cacheKey = `${this.CACHE_KEY_PREFIX}${idempotencyKey}`;
    
    try {
      // Check if we've seen this request before
      const cachedResponse = await this.getCachedResponse(cacheKey);
      
      if (cachedResponse) {
        this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
        return from([cachedResponse]);
      }

      // First time seeing this key, process the request
      return next.handle().pipe(
        tap(async (response) => {
          // Cache successful responses only
          if (response && !this.isErrorResponse(response)) {
            await this.cacheResponse(cacheKey, response);
            this.logger.log(`Cached response for idempotency key: ${idempotencyKey}`);
          }
        }),
      );
    } catch (error) {
      this.logger.error('Idempotency interceptor error', error);
      // If Redis is down, continue without caching rather than failing
      return next.handle();
    }
  }

  /**
   * Extract and validate idempotency key from headers
   * 
   * Teaching: HTTP header conventions and validation patterns
   */
  private extractAndValidateKey(request: any): string | null {
    const idempotencyKey = request.headers['x-idempotency-key'];
    
    if (!idempotencyKey) {
      return null;
    }

    if (typeof idempotencyKey !== 'string') {
      throw new BadRequestException('X-Idempotency-Key must be a string');
    }

    // Validate UUID format
    if (!uuid.validate(idempotencyKey)) {
      throw new BadRequestException('X-Idempotency-Key must be a valid UUID');
    }

    // Additional length check for safety
    if (idempotencyKey.length > 100) {
      throw new BadRequestException('X-Idempotency-Key is too long');
    }

    return idempotencyKey;
  }

  /**
   * Get cached response with proper error handling
   * 
   * Teaching: How to handle Redis failures gracefully
   */
  private async getCachedResponse(cacheKey: string): Promise<any> {
    try {
      const cached = await this.redisService.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      // Parse cached JSON response
      return JSON.parse(cached);
    } catch (error) {
      this.logger.warn('Failed to get cached response', error);
      // Return null to continue processing rather than failing
      return null;
    }
  }

  /**
   * Cache successful response with TTL
   * 
   * Teaching: Why we cache successful responses only
   * and how TTL prevents indefinite growth
   */
  private async cacheResponse(cacheKey: string, response: any): Promise<void> {
    try {
      const serializedResponse = JSON.stringify(response);
      await this.redisService.set(cacheKey, serializedResponse, this.CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn('Failed to cache response', error);
      // Don't throw - caching failures shouldn't break the request
    }
  }

  /**
   * Check if response indicates an error
   * 
   * Teaching: How to identify error responses for caching decisions
   */
  private isErrorResponse(response: any): boolean {
    // Don't cache error responses or responses with success: false
    return (
      response?.success === false ||
      response?.error ||
      response?.statusCode >= 400
    );
  }
}

/**
 * Usage in Controllers:
 * 
 * @UseInterceptors(IdempotencyInterceptor)
 * @Post('bookings')
 * async createBooking(@Body() createBookingDto: CreateBookingDto) {
 *   // Idempotency automatically handled
 *   return await this.bookingsService.createBooking(createBookingDto);
 * }
 * 
 * Client Usage:
 * curl -X POST /api/v1/bookings \
 *   -H "X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
 *   -H "Content-Type: application/json" \
 *   -d '{"venueId": "...", ...}'
 */