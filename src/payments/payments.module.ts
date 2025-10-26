import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './services/razorpay.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

/**
 * Payments Module - Razorpay Integration
 * 
 * Features:
 * 1. Payment link generation for bookings
 * 2. Webhook handling for payment status updates
 * 3. Secure signature verification
 * 4. Database payment record management
 * 5. Cache integration for performance
 * 
 * Dependencies:
 * - PrismaModule: For database operations
 * - RedisModule: For caching payment data
 * - ConfigModule: For Razorpay configuration
 */
@Module({
  imports: [
    ConfigModule, // For accessing Razorpay environment variables
    PrismaModule, // For database operations
    RedisModule,  // For caching
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    RazorpayService,
  ],
  exports: [
    PaymentsService, // Export for use in other modules (e.g., BookingsModule)
    RazorpayService, // Export for direct Razorpay operations if needed
  ],
})
export class PaymentsModule {}

/**
 * Module Architecture:
 * 
 * 📊 **Controllers**:
 * - PaymentsController: REST API endpoints for payment operations
 * 
 * 🔧 **Services**:
 * - PaymentsService: Business logic and database operations
 * - RazorpayService: Razorpay API integration and webhook verification
 * 
 * 🔗 **Integration Points**:
 * - Bookings: Payment links tied to booking lifecycle
 * - Webhooks: Automatic payment status updates
 * - Caching: Performance optimization for payment data
 * 
 * 🛡️ **Security Features**:
 * - Webhook signature verification
 * - Tenant isolation
 * - Idempotency protection
 * - Request/response logging
 */