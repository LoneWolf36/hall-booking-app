import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../services/cache.service';
import {
  CACHE_CONSTANTS,
  CACHE_PREFIXES,
  VALIDATION_CONSTANTS,
} from '../constants/app.constants';

let validateUUID: (s: string) => boolean;
try {
  // Prefer esm-compatible import when available

  validateUUID = require('uuid').validate;
} catch {
  // Fallback for environments where require is not available

  const uuid = require('uuid');
  validateUUID = uuid.validate ?? ((s: string) => false);
}

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

    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey = this.extractAndValidateKey(request);
    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `${CACHE_PREFIXES.IDEMPOTENCY}:${idempotencyKey}`;

    // ✅ FIXED: Handle cache.get failures gracefully
    let cachedResponse = null;
    try {
      cachedResponse = await this.cacheService.get(cacheKey);
    } catch (error) {
      this.logger.error('Idempotency interceptor error', error);
      // Continue without cache
    }

    if (cachedResponse) {
      this.logger.log(
        `Returning cached response for idempotency key: ${idempotencyKey}`,
      );
      return from([cachedResponse]);
    }

    return next.handle().pipe(
      tap(async (response) => {
        if (response && !this.isErrorResponse(response)) {
          // ✅ FIXED: Handle cache.set failures gracefully
          try {
            await this.cacheService.set(
              cacheKey,
              response,
              CACHE_CONSTANTS.IDEMPOTENCY_TTL_SECONDS,
            );
            this.logger.log(
              `Cached response for idempotency key: ${idempotencyKey}`,
            );
          } catch (error) {
            this.logger.error('Idempotency interceptor error', error);
            // Don't throw - continue with successful response
          }
        }
      }),
    );
  }

  private extractAndValidateKey(request: any): string | null {
    const idempotencyKey = request.headers['x-idempotency-key'];
    if (!idempotencyKey) return null;

    if (typeof idempotencyKey !== 'string') {
      throw new BadRequestException('X-Idempotency-Key must be a string');
    }

    if (!validateUUID(idempotencyKey)) {
      throw new BadRequestException('X-Idempotency-Key must be a valid UUID');
    }

    if (
      idempotencyKey.length > VALIDATION_CONSTANTS.MAX_IDEMPOTENCY_KEY_LENGTH
    ) {
      throw new BadRequestException('X-Idempotency-Key is too long');
    }

    return idempotencyKey;
  }

  private isErrorResponse(response: any): boolean {
    return (
      response?.success === false ||
      response?.error ||
      response?.statusCode >= 400
    );
  }
}