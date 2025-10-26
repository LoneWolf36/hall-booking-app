import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { RedisService } from '../../redis/redis.service';

/**
 * Idempotency Interceptor Tests
 * 
 * Teaching Points:
 * 1. Testing interceptors with mock ExecutionContext
 * 2. Redis service mocking strategies
 * 3. Observable testing patterns with RxJS
 * 4. Error handling in interceptor tests
 * 5. Async interceptor testing patterns
 */
describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let redisService: jest.Mocked<RedisService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let mockRequest: any;

  beforeEach(async () => {
    // Mock Redis service
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    redisService = module.get(RedisService);

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
    } as any;

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

      // Should pass through without Redis interaction
      expect(redisService.get).not.toHaveBeenCalled();
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should apply idempotency for POST requests', async () => {
      mockRequest.method = 'POST';
      mockRequest.headers['x-idempotency-key'] = '550e8400-e29b-41d4-a716-446655440000';
      
      redisService.get.mockResolvedValue(null); // No cached response
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(redisService.get).toHaveBeenCalledWith(
        'idempotency:550e8400-e29b-41d4-a716-446655440000'
      );
    });

    it('should apply idempotency for PUT requests', async () => {
      mockRequest.method = 'PUT';
      mockRequest.headers['x-idempotency-key'] = '550e8400-e29b-41d4-a716-446655440000';
      
      redisService.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(redisService.get).toHaveBeenCalled();
    });
  });

  describe('Idempotency Key Validation', () => {
    beforeEach(() => {
      mockRequest.method = 'POST';
    });

    it('should accept valid UUID idempotency keys', async () => {
      mockRequest.headers['x-idempotency-key'] = '550e8400-e29b-41d4-a716-446655440000';
      redisService.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler)
      ).resolves.toBeDefined();
    });

    it('should reject invalid UUID format', async () => {
      mockRequest.headers['x-idempotency-key'] = 'invalid-uuid';

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-string idempotency keys', async () => {
      mockRequest.headers['x-idempotency-key'] = ['array-value'];

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler)
      ).rejects.toThrow('X-Idempotency-Key must be a string');
    });

    it('should reject overly long idempotency keys', async () => {
      mockRequest.headers['x-idempotency-key'] = 'a'.repeat(101);

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler)
      ).rejects.toThrow('X-Idempotency-Key is too long');
    });

    it('should continue without idempotency key if none provided', async () => {
      // No idempotency key header
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(redisService.get).not.toHaveBeenCalled();
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
      redisService.get.mockResolvedValue(JSON.stringify(cachedResponse));

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
      
      redisService.get.mockResolvedValue(null); // No cache
      redisService.set.mockResolvedValue('OK');
      mockCallHandler.handle.mockReturnValue(of(response));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Subscribe to complete the observable
      await result$.toPromise();

      expect(mockCallHandler.handle).toHaveBeenCalled();
      expect(redisService.set).toHaveBeenCalledWith(
        `idempotency:${validKey}`,
        JSON.stringify(response),
        24 * 60 * 60, // 24 hours TTL
      );
    });

    it('should not cache error responses', async () => {
      const errorResponse = { success: false, error: 'Something failed' };
      
      redisService.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of(errorResponse));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await result$.toPromise();

      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should not cache responses with statusCode >= 400', async () => {
      const errorResponse = { statusCode: 400, message: 'Bad Request' };
      
      redisService.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of(errorResponse));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await result$.toPromise();

      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    const validKey = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      mockRequest.method = 'POST';
      mockRequest.headers['x-idempotency-key'] = validKey;
    });

    it('should handle Redis get failures gracefully', async () => {
      redisService.get.mockRejectedValue(new Error('Redis connection failed'));
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(result$.toPromise()).resolves.toEqual({ success: true });
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should handle Redis set failures gracefully', async () => {
      redisService.get.mockResolvedValue(null);
      redisService.set.mockRejectedValue(new Error('Redis write failed'));
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Should complete successfully despite Redis failure
      await expect(result$.toPromise()).resolves.toEqual({ success: true });
    });

    it('should handle invalid JSON in cache gracefully', async () => {
      redisService.get.mockResolvedValue('invalid-json{');
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
      redisService.get.mockResolvedValueOnce(null);
      redisService.set.mockResolvedValue('OK');
      
      // Second request - has cache
      const cachedResponse = { success: true, bookingId: 'booking-123' };
      redisService.get.mockResolvedValueOnce(JSON.stringify(cachedResponse));

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
 * 3. **Redis Mocking**: Mock external dependencies like Redis
 *    to test business logic in isolation.
 * 
 * 4. **Edge Cases**: Test error scenarios like Redis failures,
 *    invalid JSON, network timeouts.
 * 
 * 5. **Concurrency**: Test concurrent request scenarios to ensure
 *    idempotency works correctly under load.
 * 
 * 6. **State Verification**: Verify both return values and side effects
 *    (Redis calls, caching behavior).
 */