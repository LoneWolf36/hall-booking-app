import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStateMachineService } from '../services/state-machine.service';

/**
 * Booking Expiry Background Job
 * 
 * Automated cron job to handle booking lifecycle management:
 * - Expire temp_hold bookings after 30 minutes
 * - Complete confirmed bookings after event end time
 * 
 * **Schedule**:
 * - Runs every 5 minutes
 * - Processes up to 500 bookings per run
 * - Tenant-agnostic (processes all tenants)
 * 
 * **Monitoring**:
 * - Logs every execution
 * - Tracks processing time
 * - Reports expired/completed counts
 * 
 * @example
 * ```typescript
 * // Job runs automatically via @nestjs/schedule
 * // Manual trigger for testing:
 * await bookingExpiryJob.handleExpiredHolds();
 * ```
 */
@Injectable()
export class BookingExpiryJob {
  private readonly logger = new Logger(BookingExpiryJob.name);
  private isRunning = false;

  constructor(
    private readonly stateMachine: BookingStateMachineService,
  ) {}

  /**
   * Expire temp_hold bookings past holdExpiresAt
   * 
   * **Cron Schedule**: Every 5 minutes
   * **Batch Size**: 500 bookings per run
   * 
   * **Process**:
   * 1. Find temp_hold bookings with holdExpiresAt <= now
   * 2. Transition each to 'expired' status
   * 3. Invalidate caches
   * 4. Log results
   * 
   * @cron Every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'expire-temp-holds',
  })
  async handleExpiredHolds(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('⚠️  Previous expiry job still running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Starting temp_hold expiry job...');

      // Batch expire holds (500 at a time)
      const expiredCount = await this.stateMachine.batchExpireHolds(
        undefined, // Process all tenants
        500,       // Batch size
      );

      const duration = Date.now() - startTime;

      if (expiredCount > 0) {
        this.logger.log(
          `✅ Expired ${expiredCount} temp_hold bookings in ${duration}ms`,
        );
      } else {
        this.logger.debug(`✓ No expired bookings found (${duration}ms)`);
      }
    } catch (error) {
      this.logger.error('❌ Expiry job failed:', error.message, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Complete finished bookings
   * 
   * **Cron Schedule**: Every 30 minutes
   * **Batch Size**: 500 bookings per run
   * 
   * **Process**:
   * 1. Find confirmed bookings with endTs <= now
   * 2. Transition each to 'completed' status
   * 3. Update analytics
   * 4. Log results
   * 
   * @cron Every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'complete-finished-bookings',
  })
  async handleCompletedBookings(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Starting booking completion job...');

      // Batch complete bookings
      const completedCount = await this.stateMachine.batchCompleteBookings(
        undefined, // Process all tenants
        500,       // Batch size
      );

      const duration = Date.now() - startTime;

      if (completedCount > 0) {
        this.logger.log(
          `🎉 Completed ${completedCount} finished bookings in ${duration}ms`,
        );
      } else {
        this.logger.debug(`✓ No completed bookings found (${duration}ms)`);
      }
    } catch (error) {
      this.logger.error('❌ Completion job failed:', error.message, error.stack);
    }
  }

  /**
   * Health check for background jobs
   * 
   * Can be called manually or via monitoring endpoint
   * 
   * @returns Job status and last execution info
   */
  async getJobStatus() {
    return {
      expiryJob: {
        name: 'expire-temp-holds',
        schedule: 'Every 5 minutes',
        isRunning: this.isRunning,
      },
      completionJob: {
        name: 'complete-finished-bookings',
        schedule: 'Every 30 minutes',
        isRunning: false, // Completion job is lightweight
      },
    };
  }

  /**
   * Manual trigger for expiry job (testing/admin use)
   * 
   * @param limit - Maximum bookings to process
   * @returns Number of bookings processed
   */
  async manualExpiry(limit: number = 100): Promise<number> {
    this.logger.warn(`⚡ Manual expiry triggered (limit: ${limit})`);
    return await this.stateMachine.batchExpireHolds(undefined, limit);
  }

  /**
   * Manual trigger for completion job (testing/admin use)
   * 
   * @param limit - Maximum bookings to process
   * @returns Number of bookings processed
   */
  async manualCompletion(limit: number = 100): Promise<number> {
    this.logger.warn(`⚡ Manual completion triggered (limit: ${limit})`);
    return await this.stateMachine.batchCompleteBookings(undefined, limit);
  }
}
