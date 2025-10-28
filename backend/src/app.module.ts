import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
// Core modules
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { AuthModule } from './auth/auth.module';
// Filters, Interceptors, and Pipes
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
// Environment validation
import { EnvironmentVariables } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const validatedConfig = new EnvironmentVariables();
        Object.assign(validatedConfig, config);
        return validatedConfig;
      },
      envFilePath: ['.env.local', '.env'],
    }),
    // Core infrastructure modules
    PrismaModule, // Database connection (global)
    RedisModule, // Caching and session management
    HealthModule, // Application health checks

    // Authentication & Authorization
    AuthModule, // JWT authentication with phone-based OTP ✅ NEW

    // Business logic modules
    UsersModule, // User management service  ✅ Complete
    BookingsModule, // Booking management service ✅ Complete
    PaymentsModule, // Payment processing (Razorpay integration) ✅ Complete
    // Future modules:
    // VenuesModule,      // Venue management
    // NotificationsModule, // Email/SMS/WhatsApp notifications
    // AdminModule,       // Admin dashboard APIs
    // ReportsModule,     // Analytics and reporting
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global providers
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },
  ],
})
export class AppModule {}

/**
 * Application Architecture Overview:
 *
 * 📊 **Infrastructure Layer**:
 * - PrismaModule: PostgreSQL with exclusion constraints
 * - RedisModule: Caching and atomic counters
 * - ConfigModule: Environment configuration
 * - HealthModule: Application monitoring
 *
 * 🏢 **Business Logic Layer**:
 * - UsersModule: Phone-based user management
 * - BookingsModule: Core booking with double-booking prevention
 * - PaymentsModule: Razorpay integration with webhook handling
 *
 * 🔧 **Cross-cutting Concerns**:
 * - GlobalExceptionFilter: Consistent error handling
 * - LoggingInterceptor: Request/response logging
 * - CustomValidationPipe: Input validation
 *
 * 🚀 **Scalability Design**:
 * - Modular architecture for easy feature addition
 * - Multi-tenant ready with row-level security
 * - Microservices-ready module boundaries
 * - Clean dependency injection for testing
 */
