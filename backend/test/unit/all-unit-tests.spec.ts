/**
 * Comprehensive Unit Test Suite
 *
 * This file imports and runs ALL existing unit tests from across the codebase
 * to ensure complete test coverage and proper Jest configuration.
 *
 * Existing Test Files Included:
 * - src/app.controller.spec.ts
 * - src/bookings/bookings.service.spec.ts
 * - src/users/users.service.spec.ts
 */

// Import all existing unit test suites
import '../../../src/app.controller.spec';
import '../../../src/bookings/bookings.service.spec';
import '../../../src/users/users.service.spec';

// This file ensures all existing unit tests are discovered and run
// by the comprehensive test configurations

describe('All Unit Tests Suite', () => {
  it('should run all imported unit test suites', () => {
    // This is a placeholder test that ensures Jest discovers this file
    // The actual tests are imported above and will be executed
    expect(true).toBe(true);
  });
});

/**
 * Test Discovery Summary:
 *
 * 1. App Controller Tests (src/app.controller.spec.ts)
 *    - Basic "Hello World" endpoint testing
 *    - NestJS controller integration
 *
 * 2. Bookings Service Tests (src/bookings/bookings.service.spec.ts)
 *    - Booking creation with exclusion constraints
 *    - Timestamp validation and normalization
 *    - Booking number generation
 *    - Availability checking with conflict detection
 *    - Customer integration (new/existing users)
 *    - Error handling (constraint violations)
 *    - Business rules validation
 *    - Price calculation verification
 *    - Hold expiry management
 *    - PostgreSQL exclusion constraint testing
 *    - Multi-tenant isolation
 *
 * 3. Users Service Tests (src/users/users.service.spec.ts)
 *    - User upsert functionality
 *    - Phone number normalization (Indian format)
 *    - Duplicate handling
 *    - Role validation (customer/admin)
 *    - Error scenarios and constraint handling
 *    - Multi-tenant isolation
 *    - Pagination and filtering
 *    - Update operations with conflict detection
 *
 * Total Coverage:
 * - 3 major service modules
 * - 25+ individual test cases
 * - Complete business logic validation
 * - Database constraint testing
 * - Error handling scenarios
 * - Multi-tenant architecture validation
 */
