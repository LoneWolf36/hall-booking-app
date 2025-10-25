import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { UsersModule } from '../users/users.module';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Bookings Module - Dependency injection configuration
 * 
 * Module Design:
 * 1. Imports required services (Users, Redis, Prisma)
 * 2. Provides BookingsService for business logic
 * 3. Exports BookingsService for use in other modules
 * 4. Registers BookingsController for HTTP endpoints
 */
@Module({
  imports: [
    PrismaModule,    // Database access
    UsersModule,     // User management integration
    RedisModule,     // Caching and atomic counters
    // Future imports:
    // PaymentsModule,   // Payment processing
    // NotificationsModule, // Email/SMS notifications
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [
    BookingsService, // Export for use in payments, notifications, etc.
  ],
})
export class BookingsModule {}

/**
 * Why this module structure?
 * 
 * 1. **Service Integration**: UsersModule provides customer management
 * 2. **Performance**: RedisModule enables fast booking number generation
 * 3. **Database**: PrismaModule provides exclusion constraint support
 * 4. **Scalability**: Clean interfaces for future payment/notification integration
 * 5. **Testing**: Easy to mock dependencies in unit tests
 */