import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './services/razorpay.service';
import { FlexiblePaymentService } from './services/flexible-payment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

/**
 * Enhanced Payments Module - Complete flexible payment system
 * 
 * Features:
 * 1. Cash-only venues: Zero tech barrier, manual confirmation
 * 2. Hybrid venues: Customer chooses cash vs online
 * 3. Online venues: Full digital payment processing
 * 4. Marketplace venues: Platform handles everything
 * 5. Commission tracking across all payment methods
 * 6. Venue onboarding and smart recommendations
 * 
 * Architecture:
 * - FlexiblePaymentService: Core payment orchestration
 * - RazorpayService: Online payment gateway integration  
 * - PaymentsService: Database operations and webhooks
 * - PaymentsController: REST API endpoints
 * 
 * Dependencies:
 * - PrismaModule: Database operations with flexible payment schema
 * - RedisModule: Caching for payment options and performance
 * - ConfigModule: Environment configuration for Razorpay
 */
@Module({
  imports: [
    ConfigModule, // For Razorpay and payment configuration
    PrismaModule, // Database operations for all payment types
    RedisModule,  // Caching for payment options and performance
  ],
  controllers: [PaymentsController],
  providers: [
    // Core Services
    FlexiblePaymentService, // Main payment orchestration service
    PaymentsService,        // Database and webhook operations
    RazorpayService,        // Online payment gateway integration
  ],
  exports: [
    // Export main services for use in other modules
    FlexiblePaymentService, // For booking module integration
    PaymentsService,        // For payment operations
    RazorpayService,        // For direct Razorpay operations if needed
  ],
})
export class PaymentsModule {}