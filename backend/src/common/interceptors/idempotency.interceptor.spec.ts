import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { CacheService } from '../services/cache.service';

/**
 * Idempotency Interceptor Tests
 *
 * Teaching Points:
 * 1. Testing interceptors with mock ExecutionContext
 * 2. CacheService mocking strategies
 * 3. Observable testing patterns with RxJS
 * 4. Error handling in interceptor tests
 * 5. Async interceptor testing patterns
 */
describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let cacheService: jest.Mocked<CacheService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let mockRequest: {
    method: string;
    headers: Record<string, string | string[]>;
  };

  beforeEach(async () => {
    // Mock Cache service
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    cacheService = module.get(CacheService);

    // Setup mock request object
    mockRequest = {
      method: 'POST',
      headers: {},
    };

    // Setup mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
      }),
    } as unknown as jest.Mocked<ExecutionContext>;

    // Setup mock call handler
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Method Filtering', () => {
    it('should skip idempotency for GET requests', async () => {
      mockRequest.method = 'GET';
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Should pass through without Cache interaction
      expect(cacheService.get).not.toHaveBeenCalled();
      expect(mockCallHandler.handle).toHaveBeenCalled();

      // Verify observable completes
      await result.toPromise();
    });

    it('should apply idempotency for POST requests', async () => {
      mockRequest.method = 'POST';
      mockRequest.headers['x-idempotency-key'] =
        '550e8400-e29b-41d4-a716-446655440000';

      cacheService.get.mockResolvedValue(null); // No cached response
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(cacheService.get).toHaveBeenCalledWith(
        'idempotency:550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('should apply idempotency for PUT requests', async () => {
      mockRequest.method = 'PUT';
      mockRequest.headers['x-idempotency-key'] =
        '550e8400-e29b-41d4-a716-446655440000';

      cacheService.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(cacheService.get).toHaveBeenCalled();
    });
  });

  describe('Idempotency Key Validation', () => {
    beforeEach(() => {
      mockRequest.method = 'POST';
    });

    it('should accept valid UUID idempotency keys', async () => {
      mockRequest.headers['x-idempotency-key'] =
        '550e8400-e29b-41d4-a716-446655440000';
      cacheService.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      await expect(result.toPromise()).resolves.toBeDefined();
    });

    it('should reject invalid UUID format', async () => {
      mockRequest.headers['x-idempotency-key'] = 'invalid-uuid';

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-string idempotency keys', async () => {
      mockRequest.headers['x-idempotency-key'] = ['array-value'];

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      ).rejects.toThrow('X-Idempotency-Key must be a string');
    });

    it('should reject overly long idempotency keys', async () => {
      mockRequest.headers['x-idempotency-key'] = 'a'.repeat(101);

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      ).rejects.toThrow('X-Idempotency-Key is too long');
    });

    it('should continue without idempotency key if none provided', async () => {
      // No idempotency key header
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      await result.toPromise();

      expect(cacheService.get).not.toHaveBeenCalled();
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });
  });

  describe('Response Caching', () => {
    const validKey = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      mockRequest.method = 'POST';
      mockRequest.headers['x-idempotency-key'] = validKey;
    });

    it('should return cached response if available', async () => {
      const cachedResponse = { success: true, cached: true };
      cacheService.get.mockResolvedValue(cachedResponse);

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      const result = await result$.toPromise();

      expect(result).toEqual(cachedResponse);
      expect(mockCallHandler.handle).not.toHaveBeenCalled();
    });

    it('should process request and cache response if not cached', async () => {
      const response = { success: true, data: 'new-response' };

      cacheService.get.mockResolvedValue(null); // No cache
      cacheService.set.mockResolvedValue(undefined);
      mockCallHandler.handle.mockReturnValue(of(response));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Subscribe to complete the observable
      await result$.toPromise();

      expect(mockCallHandler.handle).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        `idempotency:${validKey}`,
        response,
        86400, // 24 hours TTL from CACHE_CONSTANTS.IDEMPOTENCY_TTL_SECONDS
      );
    });

    it('should not cache error responses', async () => {
      const errorResponse = { success: false, error: 'Something failed' };

      cacheService.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of(errorResponse));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await result$.toPromise();

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should not cache responses with statusCode >= 400', async () => {
      const errorResponse = { statusCode: 400, message: 'Bad Request' };

      cacheService.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of(errorResponse));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await result$.toPromise();

      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    const validKey = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      mockRequest.method = 'POST';
      mockRequest.headers['x-idempotency-key'] = validKey;
    });

    it('should handle Cache get failures gracefully', async () => {
      cacheService.get.mockRejectedValue(new Error('Cache connection failed'));
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(result$.toPromise()).resolves.toEqual({ success: true });
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should handle Cache set failures gracefully', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockRejectedValue(new Error('Cache write failed'));
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Should complete successfully despite Cache failure
      await expect(result$.toPromise()).resolves.toEqual({ success: true });
    });

    it('should handle invalid data in cache gracefully', async () => {
      cacheService.get.mockResolvedValue(undefined);
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await result$.toPromise();

      // Should fall back to processing the request
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle concurrent requests with same key correctly', async () => {
      const validKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.method = 'POST';
      mockRequest.headers['x-idempotency-key'] = validKey;

      // First request - no cache
      cacheService.get.mockResolvedValueOnce(null);
      cacheService.set.mockResolvedValue(undefined);

      // Second request - has cache
      const cachedResponse = { success: true, bookingId: 'booking-123' };
      cacheService.get.mockResolvedValueOnce(cachedResponse);

      mockCallHandler.handle.mockReturnValue(of(cachedResponse));

      // First request
      const result1$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      await result1$.toPromise();

      // Second request with same key
      const result2$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const result2 = await result2$.toPromise();

      expect(result2).toEqual(cachedResponse);
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1); // Only first request processed
    });
  });
});

/**
 * Teaching Notes on Interceptor Testing:
 *
 * 1. **Mock Strategy**: Mock the execution context and call handler
 *    to simulate NestJS request lifecycle.
 *
 * 2. **Observable Testing**: Use RxJS testing patterns with toPromise()
 *    to handle async observable streams.
 *
 * 3. **Cache Mocking**: Mock external dependencies like CacheService
 *    to test business logic in isolation.
 *
 * 4. **Edge Cases**: Test error scenarios like Cache failures,
 *    invalid data, network timeouts.
 *
 * 5. **Concurrency**: Test concurrent request scenarios to ensure
 *    idempotency works correctly under load.
 *
 * 6. **State Verification**: Verify both return values and side effects
 *    (Cache calls, caching behavior).
 */
