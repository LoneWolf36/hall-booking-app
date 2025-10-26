# Testing Guide - Hall Booking Application

## Overview

This application implements a comprehensive testing strategy covering all aspects of the flexible payment system and booking engine. The test suite ensures zero double-bookings, accurate commission calculations, and robust payment processing across all 5 payment profiles.

## Test Architecture

### Test Types

| Test Type | Purpose | Coverage | Execution Time |
|-----------|---------|----------|----------------|
| **Unit Tests** | Individual functions and components | `src/**/*.spec.ts` | < 5 minutes |
| **Integration Tests** | Module interactions and database operations | `test/**/*.integration.spec.ts` | < 10 minutes |
| **Payment Integration** | Complete payment flows for all 5 profiles | `test/integration/payment-integration.e2e-spec.ts` | < 15 minutes |
| **E2E Tests** | End-to-end application workflows | `test/**/*.e2e-spec.ts` | < 10 minutes |
| **Performance Tests** | Load testing and benchmarks | `test/**/*.performance.spec.ts` | < 20 minutes |

### Test Directory Structure

```
test/
├── integration/                    # Integration test suites
│   └── payment-integration.e2e-spec.ts  # Comprehensive payment tests
├── setup/                          # Test environment setup
│   ├── test-setup.ts              # General test configuration
│   ├── payment-test-environment.ts # Payment test utilities
│   └── performance-setup.ts       # Performance test configuration
├── mocks/                          # Mock utilities
│   └── razorpay-webhook.mock.ts   # Razorpay webhook simulator
├── utils/                          # Test utilities
│   └── test-sequencer.js          # Optimal test execution order
├── jest-*.json                     # Jest configurations for different test types
├── app.e2e-spec.ts                # Basic E2E tests
└── .env.test                       # Test environment configuration
```

## Quick Start

### Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Setup test database
createdb hall_booking_test

# 3. Configure test environment
cp .env.test .env.local
# Edit .env.local with your test database credentials

# 4. Run database setup
npm run db:test-setup
```

### Running Tests

```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test              # Unit tests only
npm run test:integration  # Integration tests
npm run test:payments     # Payment integration tests
npm run test:e2e         # End-to-end tests
npm run test:performance # Performance tests

# Development workflows
npm run test:watch                # Watch unit tests
npm run test:watch-payments       # Watch payment tests
npm run test:watch-integration    # Watch integration tests

# Coverage reports
npm run test:cov          # Unit test coverage
npm run test:full-coverage # Complete coverage report

# CI/CD workflows
npm run test:ci           # CI-optimized test suite
```

## Payment Integration Testing

### Coverage Matrix

The payment integration tests ensure all 5 payment profiles work correctly:

| Payment Profile | Commission | Test Scenarios | Coverage |
|----------------|------------|-----------------|----------|
| **Cash Only** | 5% | Venue onboarding, booking creation, cash recording, commission calculation | ✅ Complete |
| **Cash + Deposit** | 7% | Deposit payment, remaining cash collection, partial payment handling | ✅ Complete |
| **Hybrid Flexible** | 8% | Customer choice, method switching, preference learning | ✅ Complete |
| **Full Online** | 10% | Online-only payments, instant confirmation, webhook processing | ✅ Complete |
| **Marketplace** | 15% | Platform-managed payments, automatic commission collection | ✅ Complete |

### Critical Test Cases

#### 1. Cash-Only Venue Flow
```bash
# Test: Complete cash-only venue workflow
it('should handle complete cash-only venue onboarding and booking flow')
```
- ✅ Venue configuration validation
- ✅ Booking creation with cash-only constraints
- ✅ Payment options limited to cash
- ✅ Cash payment recording by venue staff
- ✅ 5% commission calculation and recording
- ✅ Booking confirmation and status updates

#### 2. Hybrid Payment Flexibility
```bash
# Test: Customer payment method selection and switching
it('should allow customer to choose between cash and online payment')
```
- ✅ Multiple payment method availability
- ✅ Customer payment method switching
- ✅ Online payment link generation
- ✅ Cash payment alternative processing
- ✅ Consistent 8% commission regardless of method

#### 3. Webhook Security and Processing
```bash
# Test: Razorpay webhook signature validation
it('should validate webhook signatures correctly')
```
- ✅ Valid signature processing
- ✅ Invalid signature rejection
- ✅ Duplicate webhook idempotency
- ✅ Payment success handling
- ✅ Payment failure processing

#### 4. Multi-Tenant Isolation
```bash
# Test: Payment data isolation between tenants
it('should maintain payment isolation between tenants')
```
- ✅ Cross-tenant access prevention
- ✅ Webhook routing to correct tenant
- ✅ Commission record segregation
- ✅ Payment link tenant scoping

#### 5. Performance Benchmarks
```bash
# Test: Payment operation response times
it('should process payment operations within target response times')
```
- ✅ Payment options generation < 100ms
- ✅ Cash payment recording < 50ms
- ✅ Commission calculation < 25ms
- ✅ Booking creation < 300ms

## Test Environment Setup

### Database Configuration

```bash
# PostgreSQL test database
DATABASE_URL="postgresql://username:password@localhost:5432/hall_booking_test"

# Redis for caching tests (optional)
UPSTASH_REDIS_REST_URL="redis://localhost:6379/1"
```

### Mock Services

#### Razorpay Webhook Mock
The `MockRazorpayWebhook` class provides realistic webhook simulation:

```typescript
// Create payment success webhook
const webhook = mockWebhook.createPaymentSuccessWebhook({
  paymentId: 'pay_test_123',
  amount: 10000,
  bookingId: booking.id
});

// Validate signature
const isValid = mockWebhook.validateSignature(
  webhook.payloadString, 
  webhook.signature
);
```

#### Payment Test Environment
The `PaymentTestEnvironment` class handles test data creation:

```typescript
// Create venue with specific payment profile
const testData = await testEnv.createCashOnlyVenue();
const { tenant, venue, customer } = testData;

// Create booking for testing
const booking = await testEnv.createBooking({
  venueId: venue.id,
  userId: customer.id,
  totalAmountCents: 10000
});
```

## Performance Testing

### Load Testing Scenarios

```typescript
// Concurrent booking creation
const results = await performanceUtils.runConcurrentRequests(
  () => createBooking(testData),
  20, // 20 concurrent users
  30000 // 30 second duration
);

// Performance assertions
expect(results.averageResponseTime).toBeLessThan(300);
expect(results.successRate).toBeGreaterThan(95);
```

### Benchmark Targets

| Operation | Target Response Time | Test Coverage |
|-----------|---------------------|---------------|
| Booking Creation | < 300ms | ✅ Tested |
| Payment Options Generation | < 100ms | ✅ Tested |
| Cash Payment Recording | < 50ms | ✅ Tested |
| Commission Calculation | < 25ms | ✅ Tested |
| Availability Check | < 100ms | ✅ Tested |

## CI/CD Integration

### GitHub Actions Workflow

The comprehensive test suite runs automatically on:
- Every push to `main` or `develop` branches
- All pull requests
- Daily scheduled runs for performance testing

#### Workflow Jobs

1. **Unit Tests** (5-10 minutes)
   - Fast feedback on code changes
   - No external dependencies
   
2. **Integration Tests** (10-15 minutes)
   - Database and Redis integration
   - Module interaction validation
   
3. **Payment Integration Tests** (15-20 minutes)
   - Complete payment flow validation
   - All 5 payment profiles tested
   - Webhook processing verification
   
4. **E2E Tests** (10-15 minutes)
   - Full application workflow testing
   - API endpoint validation
   
5. **Performance Tests** (20-25 minutes, scheduled only)
   - Load testing and benchmarking
   - Performance regression detection

### Coverage Requirements

| Module | Line Coverage | Branch Coverage | Function Coverage |
|--------|---------------|-----------------|-------------------|
| **Global** | 80% | 70% | 75% |
| **Payments** | 90% | 85% | 90% |
| **Bookings** | 85% | 80% | 85% |

## Debugging Tests

### Common Issues

#### Database Connection Issues
```bash
# Check database connection
psql -h localhost -U username -d hall_booking_test

# Reset test database
dropdb hall_booking_test && createdb hall_booking_test
npx prisma migrate deploy
```

#### Redis Connection Issues
```bash
# Check Redis connection
redis-cli ping

# Use different Redis database
UPSTASH_REDIS_REST_URL="redis://localhost:6379/1"
```

#### Test Timeouts
```bash
# Increase test timeout for debugging
ENABLE_TEST_LOGS=true npm run test:payments

# Run single test file
npx jest test/integration/payment-integration.e2e-spec.ts --verbose
```

### Debug Mode

```bash
# Enable detailed logging
ENABLE_TEST_LOGS=true npm run test:payments

# Debug specific test
npm run test:debug -- --testNamePattern="cash-only venue"

# Run tests in band (no parallelization)
npm run test:payments -- --runInBand
```

## Test Data Management

### Automatic Cleanup
Tests automatically clean up data between runs:
- Tenant isolation ensures no cross-contamination
- Database cleanup in `beforeEach` and `afterAll` hooks
- Redis cache clearing between test suites

### Test Data Factories
```typescript
// Create standardized test data
const venue = await testEnv.createVenueWithProfile('hybrid_flexible');
const booking = await testEnv.createBooking({ venueId: venue.id });
const payment = await testEnv.simulatePaymentComplete(booking.id, 'online');
```

## Contributing

### Adding New Tests

1. **Unit Tests**: Add to `src/**/*.spec.ts` alongside source files
2. **Integration Tests**: Add to `test/**/*.integration.spec.ts`
3. **Payment Tests**: Extend `test/integration/payment-integration.e2e-spec.ts`
4. **Performance Tests**: Add to `test/**/*.performance.spec.ts`

### Test Naming Convention

```typescript
describe('PaymentService', () => {
  describe('calculateCommission', () => {
    it('should calculate 5% commission for cash-only venues', () => {
      // Test implementation
    });
    
    it('should handle edge case: zero amount booking', () => {
      // Edge case testing
    });
  });
});
```

### Coverage Requirements for PRs

- All new payment-related code must have 90%+ coverage
- Integration tests required for new payment profiles
- Performance tests for operations with < 100ms targets

## Maintenance

### Regular Tasks

```bash
# Update test dependencies
npm update --save-dev

# Review and update performance benchmarks
npm run test:performance

# Generate fresh coverage reports
npm run test:full-coverage

# Validate test environment
npm run db:test-setup && npm run test:ci
```

### Monitoring Test Health

- **Daily**: Automated test runs via GitHub Actions
- **Weekly**: Performance benchmark review
- **Monthly**: Test coverage analysis and improvement
- **Release**: Full test suite validation with manual verification

---

## Support

For test-related issues:
1. Check this documentation
2. Review test logs with `ENABLE_TEST_LOGS=true`
3. Validate test environment configuration
4. Create issue with test failure details and environment info

**Built with comprehensive testing for production reliability! 🚀**
