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
import { CacheService } from '../services/cache.service';
import { CACHE_CONSTANTS, CACHE_PREFIXES, VALIDATION_CONSTANTS } from '../constants/app.constants';
import * as uuid from 'uuid';

/**
 * Idempotency Interceptor - Refactored to use centralized services
 * 
 * Now uses:
 * - CacheService for consistent caching operations
 * - Centralized constants from app.constants.ts
 * - Eliminates hardcoded cache TTL and key prefix values
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly cacheService: CacheService) {}

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
      return next.handle();
    }

    const cacheKey = `${CACHE_PREFIXES.IDEMPOTENCY}:${idempotencyKey}`;
    
    try {
      // Check if we've seen this request before using CacheService
      const cachedResponse = await this.cacheService.get(cacheKey);
      
      if (cachedResponse) {
        this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
        return from([cachedResponse]);
      }

      // First time seeing this key, process the request
      return next.handle().pipe(
        tap(async (response) => {
          // Cache successful responses only
          if (response && !this.isErrorResponse(response)) {
            await this.cacheService.set(
              cacheKey,
              response,
              CACHE_CONSTANTS.IDEMPOTENCY_TTL_SECONDS
            );
            this.logger.log(`Cached response for idempotency key: ${idempotencyKey}`);
          }
        }),
      );
    } catch (error) {
      this.logger.error('Idempotency interceptor error', error);
      // If cache is down, continue without caching rather than failing
      return next.handle();
    }
  }

  /**
   * Extract and validate idempotency key using centralized constants
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

    // Use centralized validation constant
    if (idempotencyKey.length > VALIDATION_CONSTANTS.MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException('X-Idempotency-Key is too long');
    }

    return idempotencyKey;
  }

  /**
   * Check if response indicates an error
   */
  private isErrorResponse(response: any): boolean {
    return (
      response?.success === false ||
      response?.error ||
      response?.statusCode >= 400
    );
  }
}