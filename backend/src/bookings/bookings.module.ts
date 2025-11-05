import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingNumberService } from './services/booking-number.service';
import { BookingStateMachineService } from './services/state-machine.service';
import { BookingExpiryJob } from './jobs/booking-expiry.job';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ErrorHandlerService } from '../common/services/error-handler.service';
import { CacheService } from '../common/services/cache.service';
import { ValidationService } from '../common/services/validation.service';
import { VenueBookingsController } from './controllers/venue-bookings.controller';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { AvailabilityService } from './services/availability.service';

/**
 * Refactored Bookings Module - Uses centralized services + State Machine
 *
 * Key Changes:
 * 1. Added CacheService for centralized caching
 * 2. Added ValidationService for centralized validation
 * 3. Added BookingStateMachineService for state transitions
 * 4. Added BookingExpiryJob for automated expiry (30-min temp_hold)
 * 5. Maintains clean separation of concerns
 * 6. Reduces code duplication across services
 */
@Module({
  imports: [
    // Core infrastructure modules
    PrismaModule, // Database access
    RedisModule, // Caching and atomic operations
    UsersModule, // Customer management integration
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
  controllers: [BookingsController, VenueBookingsController, AvailabilitySlotsController],
  providers: [
    // Core booking service
    BookingsService,

    // Specialized services
    BookingNumberService, // Atomic sequence generation
    AvailabilityService, // Booking availability checks
    BookingStateMachineService, // State transition management

    // Background jobs
    BookingExpiryJob, // Automated expiry (every 5 mins)

    // Centralized services (eliminates duplication)
    ErrorHandlerService, // Centralized error handling
    CacheService, // Centralized caching operations
    ValidationService, // Centralized validation logic
  ],
  exports: [
    // Export services that other modules might need
    BookingsService,
    BookingNumberService,
    AvailabilityService,
    BookingStateMachineService, // Export for use in other modules
    CacheService,
    ValidationService,
  ],
})
export class BookingsModule {
  /**
   * Refactored Module Architecture:
   *
   * 1. **Centralized Services**:
   *    - CacheService: Unified caching across all booking operations
   *    - ValidationService: Consistent validation rules
   *    - ErrorHandlerService: Standardized error handling
   *    - BookingStateMachineService: Complete state transition logic
   *
   * 2. **Automated Background Jobs**:
   *    - BookingExpiryJob: Expires temp_hold bookings after 30 minutes
   *    - Runs every 5 minutes via @nestjs/schedule
   *    - Completes finished bookings every 30 minutes
   *
   * 3. **Eliminated Duplication**:
   *    - Removed duplicate caching methods from BookingsService
   *    - Consolidated validation logic in ValidationService
   *    - Single source of truth for availability checking
   *
   * 4. **Improved Maintainability**:
   *    - Changes to validation rules happen in one place
   *    - Caching behavior is consistent across services
   *    - Error handling follows standard patterns
   *    - State transitions follow FSM rules
   */
}