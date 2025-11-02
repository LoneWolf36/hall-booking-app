import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { CacheService } from '../services/cache.service';

/**
 * Idempotency Interceptor Tests
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
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

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

    mockRequest = { method: 'POST', headers: {} };
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({ getRequest: () => mockRequest }),
    } as unknown as jest.Mocked<ExecutionContext>;

    mockCallHandler = { handle: jest.fn() } as any;

    jest.clearAllMocks();
  });

  describe('Error Handling', () => {
    const validKey = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      mockRequest.method = 'POST';
      mockRequest.headers['x-idempotency-key'] = validKey;
    });

    it('should handle Cache get failures gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      cacheService.get.mockRejectedValue(new Error('Cache connection failed'));
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(firstValueFrom(result$)).resolves.toEqual({ success: true });
    });

    it('should handle Cache set failures gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockRejectedValue(new Error('Cache write failed'));
      mockCallHandler.handle.mockReturnValue(of({ success: true }));

      const result$ = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(firstValueFrom(result$)).resolves.toEqual({ success: true });
    });
  });
});
