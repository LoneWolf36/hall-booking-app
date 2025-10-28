import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test configuration
jest.setTimeout(30000);

// Setup global test environment
beforeAll(() => {
  // Ensure test environment is properly configured
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for integration tests');
  }

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.warn('Redis URL not set - some tests may be skipped');
  }

  // Set test-specific environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_key';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_integration_key_id';
  process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_key_secret';
});

// Cleanup after all tests
afterAll(async () => {
  // Cleanup will be handled by individual test suites
  // to avoid interfering with parallel test execution
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

// Suppress console.log in tests unless explicitly enabled
if (process.env.ENABLE_TEST_LOGS !== 'true') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging
}

export {};
