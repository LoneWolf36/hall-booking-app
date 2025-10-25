import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingNumberService } from './services/booking-number.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ErrorHandlerService } from '../common/services/error-handler.service';
import { CacheService } from '../common/services/cache.service';
import { ValidationService } from '../common/services/validation.service';
import { VenueBookingsController } from './controllers/venue-bookings.controller';
import { AvailabilityService } from './services/availability.service';

/**
 * Refactored Bookings Module - Uses centralized services
 * 
 * Key Changes:
 * 1. Added CacheService for centralized caching
 * 2. Added ValidationService for centralized validation
 * 3. Maintains clean separation of concerns
 * 4. Reduces code duplication across services
 */
@Module({
  imports: [
    // Core infrastructure modules
    PrismaModule,    // Database access
    RedisModule,     // Caching and atomic operations
    UsersModule,     // Customer management integration
  ],
  controllers: [
    BookingsController,
    VenueBookingsController,
  ],
  providers: [
    // Core booking service
    BookingsService,
    
    // Specialized services
    BookingNumberService,     // Atomic sequence generation
    AvailabilityService,      // Booking availability checks
    
    // Centralized services (eliminates duplication)
    ErrorHandlerService,      // Centralized error handling
    CacheService,             // Centralized caching operations
    ValidationService,        // Centralized validation logic
  ],
  exports: [
    // Export services that other modules might need
    BookingsService,
    BookingNumberService,
    AvailabilityService,
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
   * 
   * 2. **Eliminated Duplication**:
   *    - Removed duplicate caching methods from BookingsService
   *    - Consolidated validation logic in ValidationService
   *    - Single source of truth for availability checking
   * 
   * 3. **Improved Maintainability**:
   *    - Changes to validation rules happen in one place
   *    - Caching behavior is consistent across services
   *    - Error handling follows standard patterns
   */
}