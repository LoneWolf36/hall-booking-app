import { UseInterceptors, applyDecorators } from '@nestjs/common';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';

/**
 * Idempotent Decorator - Simplifies applying idempotency to endpoints
 *
 * Teaching Points:
 * 1. Decorator composition pattern in NestJS
 * 2. How to combine multiple decorators into one
 * 3. Automatic Swagger documentation generation
 * 4. Clean API design principles
 *
 * Usage:
 * @Idempotent()
 * @Post('bookings')
 * async createBooking() { ... }
 */
export function Idempotent(options: { required?: boolean } = {}) {
  const { required = false } = options;

  return applyDecorators(
    // Apply the idempotency interceptor
    UseInterceptors(IdempotencyInterceptor),

    // Auto-generate Swagger documentation
    ApiHeader({
      name: 'X-Idempotency-Key',
      description:
        'UUID for idempotent request handling. Prevents duplicate processing of the same request.',
      required,
      schema: {
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    }),

    // Document possible idempotency responses
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid idempotency key format',
    }),

    ApiResponse({
      status: 409,
      description: 'Conflict - Request already processed with different result',
    }),
  );
}

/**
 * Strict Idempotent Decorator - Requires idempotency key
 * Use this for critical operations like payments and bookings
 */
export function RequireIdempotency() {
  return Idempotent({ required: true });
}

/**
 * Optional Idempotent Decorator - Idempotency key is optional
 * Use this for operations where idempotency is helpful but not critical
 */
export function OptionalIdempotency() {
  return Idempotent({ required: false });
}

/**
 * Teaching Notes:
 *
 * 1. **Decorator Composition**: We're using applyDecorators() to combine
 *    multiple decorators into a single, reusable decorator. This is a
 *    powerful pattern for creating clean, maintainable APIs.
 *
 * 2. **Swagger Integration**: By including ApiHeader and ApiResponse,
 *    we automatically generate proper API documentation that shows
 *    developers how to use idempotency correctly.
 *
 * 3. **Flexibility**: We provide both required and optional variants
 *    so different endpoints can have different idempotency policies.
 *
 * 4. **Type Safety**: TypeScript ensures we can't pass invalid options
 *    to the decorator, catching errors at compile time.
 */
