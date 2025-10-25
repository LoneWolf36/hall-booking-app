import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingNumberService } from './services/booking-number.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ErrorHandlerService } from '../common/services/error-handler.service';

/**
 * Bookings Module - Complete booking management with dependencies
 * 
 * Teaching Points:
 * 1. Module dependency injection and organization
 * 2. Service composition and separation of concerns
 * 3. Cross-module dependencies and imports
 * 4. Provider registration patterns
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
  ],
  providers: [
    // Core booking service
    BookingsService,
    
    // Specialized services
    BookingNumberService,    // Atomic sequence generation
    ErrorHandlerService,     // Centralized error handling
    
    // Note: RedisService and PrismaService are provided by their modules
    // UsersService is provided by UsersModule
  ],
  exports: [
    // Export services that other modules might need
    BookingsService,
    BookingNumberService,
  ],
})
export class BookingsModule {
  /**
   * Module Architecture Notes:
   * 
   * 1. **Layered Dependencies**:
   *    - Controller → Service (business logic)
   *    - Service → Repository (data access via Prisma)
   *    - Service → External Services (Redis, Users)
   * 
   * 2. **Service Composition**:
   *    - BookingsService: Core business logic
   *    - BookingNumberService: Specialized sequence generation
   *    - ErrorHandlerService: Cross-cutting error handling
   * 
   * 3. **Cross-Module Integration**:
   *    - UsersModule: Customer upsert functionality
   *    - RedisModule: Caching and atomic operations
   *    - PrismaModule: Database access patterns
   * 
   * 4. **Exports Strategy**:
   *    - Export services that other modules need
   *    - Keep internal services private when possible
   */
}