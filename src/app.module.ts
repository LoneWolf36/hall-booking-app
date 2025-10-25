import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
// New modules
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
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
    // Core infrastructure
    PrismaModule, // Database connection (global)
    RedisModule,  // Caching and session management
    HealthModule, // Application health checks
    
    // Business modules
    UsersModule,  // User management service
    // Future modules:
    // VenuesModule,   // Venue management
    // BookingsModule, // Booking management 
    // PaymentsModule, // Payment processing
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
 * Module Integration Strategy:
 * 
 * 1. **Infrastructure First**: PrismaModule, RedisModule, ConfigModule
 * 2. **Business Logic**: UsersModule, future booking/payment modules
 * 3. **Cross-cutting**: Health checks, logging, validation
 * 4. **Global Services**: Configuration, database, caching
 */