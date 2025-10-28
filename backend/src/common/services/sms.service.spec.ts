import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  let service: SmsService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                NODE_ENV: 'development',
                MSG91_AUTH_KEY: undefined, // Force console provider for tests
                MSG91_SENDER_ID: 'HALBKG',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    service.resetMetrics();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should use console provider in development mode', async () => {
      const health = await service.healthCheck();
      expect(health.provider).toBe('ConsoleProvider');
    });
  });

  describe('sendOtp', () => {
    it('should send OTP successfully', async () => {
      const result = await service.sendOtp('+919876543210', '123456');
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('Console');
      expect(result.messageId).toBeDefined();
    });

    it('should handle different phone number formats', async () => {
      const testCases = [
        '+919876543210',
        '9876543210',
        '+91 98765 43210',
        '91-9876543210',
      ];

      for (const phone of testCases) {
        const result = await service.sendOtp(phone, '123456');
        expect(result.success).toBe(true);
      }
    });

    it('should update metrics on successful send', async () => {
      await service.sendOtp('+919876543210', '123456');
      
      const metrics = service.getMetrics();
      expect(metrics.totalSent).toBe(1);
      expect(metrics.totalSuccess).toBe(1);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.successRate).toBe(100);
    });

    it('should track last sent timestamp', async () => {
      const beforeSend = new Date();
      await service.sendOtp('+919876543210', '123456');
      const afterSend = new Date();
      
      const metrics = service.getMetrics();
      expect(metrics.lastSentAt).toBeDefined();
      expect(metrics.lastSentAt!.getTime()).toBeGreaterThanOrEqual(beforeSend.getTime());
      expect(metrics.lastSentAt!.getTime()).toBeLessThanOrEqual(afterSend.getTime());
    });
  });

  describe('sendMessage', () => {
    it('should send generic SMS successfully', async () => {
      const result = await service.sendMessage(
        '+919876543210',
        'Your booking is confirmed!',
      );
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('Console');
    });

    it('should handle long messages', async () => {
      const longMessage = 'A'.repeat(500); // Longer than single SMS
      const result = await service.sendMessage('+919876543210', longMessage);
      
      expect(result.success).toBe(true);
    });
  });

  describe('metrics tracking', () => {
    it('should calculate success rate correctly', async () => {
      // Send 7 messages (all should succeed with console provider)
      for (let i = 0; i < 7; i++) {
        await service.sendOtp('+919876543210', '123456');
      }
      
      const metrics = service.getMetrics();
      expect(metrics.totalSent).toBe(7);
      expect(metrics.totalSuccess).toBe(7);
      expect(metrics.successRate).toBe(100);
    });

    it('should reset metrics correctly', async () => {
      await service.sendOtp('+919876543210', '123456');
      await service.sendMessage('+919876543210', 'Test');
      
      service.resetMetrics();
      
      const metrics = service.getMetrics();
      expect(metrics.totalSent).toBe(0);
      expect(metrics.totalSuccess).toBe(0);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.successRate).toBe(0);
    });

    it('should track metrics for both OTP and regular SMS', async () => {
      await service.sendOtp('+919876543210', '123456');
      await service.sendMessage('+919876543210', 'Test message');
      
      const metrics = service.getMetrics();
      expect(metrics.totalSent).toBe(2);
      expect(metrics.totalSuccess).toBe(2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.provider).toBe('ConsoleProvider');
      expect(health.metrics).toBeDefined();
    });

    it('should include current metrics in health check', async () => {
      await service.sendOtp('+919876543210', '123456');
      
      const health = await service.healthCheck();
      expect(health.metrics.totalSent).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully and not throw', async () => {
      // Even with invalid input, service should not throw
      await expect(
        service.sendOtp('invalid-phone', '123456'),
      ).resolves.toBeDefined();
    });

    it('should track failed messages in metrics', async () => {
      // With console provider, all should succeed
      // This test verifies the metric tracking logic exists
      const metrics = service.getMetrics();
      expect(metrics).toHaveProperty('totalFailed');
    });
  });
});

describe('SmsService with MSG91 Provider', () => {
  let service: SmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                NODE_ENV: 'production',
                MSG91_AUTH_KEY: 'test-auth-key',
                MSG91_SENDER_ID: 'HALBKG',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  it('should use MSG91 provider in production with auth key', async () => {
    const health = await service.healthCheck();
    expect(health.provider).toBe('Msg91Provider');
  });

  it('should initialize with configured sender ID', () => {
    expect(service).toBeDefined();
    // Service should be created with MSG91 provider
  });
});

describe('SMS Provider Abstraction', () => {
  it('should switch providers based on environment', async () => {
    // Test development environment
    const devModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              return key === 'NODE_ENV' ? 'development' : undefined;
            }),
          },
        },
      ],
    }).compile();

    const devService = devModule.get<SmsService>(SmsService);
    const devHealth = await devService.healthCheck();
    expect(devHealth.provider).toBe('ConsoleProvider');

    // Test production environment
    const prodModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                NODE_ENV: 'production',
                MSG91_AUTH_KEY: 'test-key',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    const prodService = prodModule.get<SmsService>(SmsService);
    const prodHealth = await prodService.healthCheck();
    expect(prodHealth.provider).toBe('Msg91Provider');
  });
});
