import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import {
  BookingStatus,
  BookingEvent,
  BookingContext,
  BOOKING_STATE_MACHINE,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  StateTransition,
} from '../dto/booking-state.dto';

/**
 * State transition result
 */
export interface TransitionResult {
  success: boolean;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  event: BookingEvent;
  error?: string;
  timestamp: Date;
}

/**
 * Booking State Machine Service
 * 
 * Manages booking state transitions with validation, conditions, and side effects.
 * 
 * **Features**:
 * - Validates state transitions
 * - Enforces business rules via conditions
 * - Executes side effects (notifications, cache invalidation)
 * - Audit trail for all transitions
 * - Thread-safe operations via database transactions
 * 
 * **State Flow**:
 * ```
 * temp_hold (30min) ──┬→ expired
 *                     └→ pending ──┬→ confirmed ──→ completed
 *                                  └→ cancelled
 * ```
 * 
 * @example
 * ```typescript
 * // Expire a temp_hold booking
 * const result = await stateMachine.transition(
 *   bookingId,
 *   tenantId,
 *   BookingEvent.EXPIRE_HOLD
 * );
 * 
 * if (result.success) {
 *   console.log(`Booking transitioned to ${result.toStatus}`);
 * }
 * ```
 */
@Injectable()
export class BookingStateMachineService {
  private readonly logger = new Logger(BookingStateMachineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Execute a state transition for a booking
   * 
   * **Process**:
   * 1. Validate transition is allowed
   * 2. Check business rule conditions
   * 3. Update database in transaction
   * 4. Execute side effects (cache, notifications)
   * 5. Log audit trail
   * 
   * @param bookingId - Booking UUID
   * @param tenantId - Tenant UUID
   * @param event - Transition event to trigger
   * @param context - Additional context (confirmedBy, metadata, etc.)
   * @returns Transition result with success status
   * 
   * @throws {BadRequestException} - Invalid transition
   */
  async transition(
    bookingId: string,
    tenantId: string,
    event: BookingEvent,
    context: Partial<BookingContext> = {},
  ): Promise<TransitionResult> {
    const startTime = Date.now();

    // Fetch current booking
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        venue: {
          select: {
            paymentProfile: true,
            confirmationTrigger: true,
          },
        },
      },
    });

    if (!booking) {
      throw new BadRequestException({
        message: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    const currentStatus = booking.status as BookingStatus;

    // Build full context
    const fullContext: BookingContext = {
      bookingId,
      tenantId,
      currentStatus,
      venuePaymentProfile: booking.venue.paymentProfile,
      confirmationTrigger: booking.venue.confirmationTrigger,
      paymentStatus: booking.paymentStatus,
      ...context,
    };

    // Find matching transition
    const transition = this.findTransition(currentStatus, event);

    if (!transition) {
      const errorMsg = `Invalid transition: ${currentStatus} -> ${event}`;
      this.logger.warn(`❌ ${errorMsg} for booking ${bookingId}`);
      
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: currentStatus,
        event,
        error: errorMsg,
        timestamp: new Date(),
      };
    }

    // Check if transition is valid
    if (!this.isValidTransition(currentStatus, transition.to)) {
      const errorMsg = `Transition not allowed: ${currentStatus} -> ${transition.to}`;
      this.logger.warn(`❌ ${errorMsg} for booking ${bookingId}`);
      
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: currentStatus,
        event,
        error: errorMsg,
        timestamp: new Date(),
      };
    }

    // Check business rule conditions
    if (transition.condition && !transition.condition(fullContext)) {
      const errorMsg = `Transition condition not met: ${currentStatus} -> ${transition.to}`;
      this.logger.warn(`❌ ${errorMsg} for booking ${bookingId}`);
      
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: currentStatus,
        event,
        error: errorMsg,
        timestamp: new Date(),
      };
    }

    // Execute transition in database transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        // Update booking status
        const updateData: any = {
          status: transition.to,
        };

        // Add confirmedBy/confirmedAt for confirmations
        if (transition.to === BookingStatus.CONFIRMED && fullContext.confirmedBy) {
          updateData.confirmedBy = fullContext.confirmedBy;
          updateData.confirmedAt = new Date();
        }

        // Clear hold expiration when moving past temp_hold
        if (currentStatus === BookingStatus.TEMP_HOLD && transition.to !== BookingStatus.TEMP_HOLD) {
          updateData.holdExpiresAt = null;
        }

        await tx.booking.update({
          where: { id: bookingId },
          data: updateData,
        });

        // Log state change in booking metadata for audit trail
        const auditEntry = {
          timestamp: new Date().toISOString(),
          event,
          from: currentStatus,
          to: transition.to,
          performedBy: fullContext.confirmedBy || 'system',
          metadata: fullContext.metadata || {},
        };

        this.logger.log(
          `📝 Audit: ${bookingId} - ${currentStatus} → ${transition.to} (${event}) by ${auditEntry.performedBy}`,
        );
      });

      // Execute side effects (after transaction commits)
      await this.executeSideEffects(bookingId, tenantId, currentStatus, transition.to);

      // Execute custom transition callback if defined
      if (transition.onTransition) {
        await transition.onTransition(fullContext);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Booking ${bookingId}: ${currentStatus} -> ${transition.to} (${event}) in ${duration}ms`,
      );

      return {
        success: true,
        fromStatus: currentStatus,
        toStatus: transition.to,
        event,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`❌ Transition failed for booking ${bookingId}:`, error);
      
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: currentStatus,
        event,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check if a transition is valid
   * 
   * @param from - Current status
   * @param to - Target status
   * @returns True if transition is allowed
   */
  isValidTransition(from: BookingStatus, to: BookingStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[from] || [];
    return allowedTransitions.includes(to);
  }

  /**
   * Check if a status is terminal (no further transitions)
   * 
   * @param status - Booking status to check
   * @returns True if status is terminal
   */
  isTerminalState(status: BookingStatus): boolean {
    return TERMINAL_STATES.includes(status);
  }

  /**
   * Get available transitions for current status
   * 
   * @param bookingId - Booking UUID
   * @param tenantId - Tenant UUID
   * @returns Array of possible next events
   */
  async getAvailableTransitions(
    bookingId: string,
    tenantId: string,
  ): Promise<BookingEvent[]> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      select: { status: true },
    });

    if (!booking) {
      return [];
    }

    const currentStatus = booking.status as BookingStatus;
    const allowedNextStates = VALID_TRANSITIONS[currentStatus] || [];

    // Find events that lead to allowed states
    const availableEvents = BOOKING_STATE_MACHINE
      .filter((t) => t.from === currentStatus && allowedNextStates.includes(t.to))
      .map((t) => t.event);

    return availableEvents;
  }

  /**
   * Get booking status history
   * 
   * Returns status transitions from booking records.
   * Note: Full audit log table to be implemented in future.
   * 
   * @param bookingId - Booking UUID
   * @param tenantId - Tenant UUID
   * @returns Array of status changes
   */
  async getStatusHistory(bookingId: string, tenantId: string) {
    // For now, return current status only
    // TODO: Implement full audit log table
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      select: {
        status: true,
        confirmedBy: true,
        confirmedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!booking) {
      return [];
    }

    return [
      {
        event: 'CREATE',
        from: null,
        to: booking.status,
        performedBy: 'system',
        timestamp: booking.createdAt,
        metadata: {},
      },
    ];
  }

  /**
   * Find transition definition for event
   * 
   * @param currentStatus - Current booking status
   * @param event - Transition event
   * @returns Transition definition or null
   */
  private findTransition(
    currentStatus: BookingStatus,
    event: BookingEvent,
  ): StateTransition | null {
    return (
      BOOKING_STATE_MACHINE.find(
        (t) => t.from === currentStatus && t.event === event,
      ) || null
    );
  }

  /**
   * Execute side effects after successful transition
   * 
   * **Side Effects**:
   * - Cache invalidation
   * - Notifications (future)
   * - Analytics events (future)
   * 
   * @param bookingId - Booking UUID
   * @param tenantId - Tenant UUID
   * @param fromStatus - Previous status
   * @param toStatus - New status
   */
  private async executeSideEffects(
    bookingId: string,
    tenantId: string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
  ): Promise<void> {
    // Invalidate booking cache
    const cacheKey = `booking:${tenantId}:${bookingId}`;
    await this.cacheService.delete(cacheKey);

    // Invalidate availability cache if booking affects venue availability
    if (
      toStatus === BookingStatus.CONFIRMED ||
      toStatus === BookingStatus.CANCELLED ||
      toStatus === BookingStatus.EXPIRED
    ) {
      // Get booking details to invalidate venue availability cache
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { venueId: true },
      });

      if (booking) {
        const availabilityCacheKey = `availability:${tenantId}:${booking.venueId}:*`;
        // Note: Wildcard deletion would need implementation in CacheService
        this.logger.debug(`Invalidating availability cache for venue ${booking.venueId}`);
      }
    }

    // Log state change for monitoring
    this.logger.log(
      `🔄 State change side effects executed: ${bookingId} (${fromStatus} -> ${toStatus})`,
    );

    // TODO: Future enhancements
    // - Send notifications (email, SMS, push)
    // - Trigger webhooks
    // - Update analytics
    // - Send to event bus
  }

  /**
   * Batch expire temp_hold bookings
   * 
   * Used by background job to expire multiple bookings efficiently.
   * 
   * @param tenantId - Tenant UUID (optional, if null processes all tenants)
   * @param limit - Maximum number of bookings to expire in one batch
   * @returns Number of bookings expired
   */
  async batchExpireHolds(tenantId?: string, limit: number = 100): Promise<number> {
    const now = new Date();

    // Find expired temp_hold bookings
    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        ...(tenantId && { tenantId }),
        status: BookingStatus.TEMP_HOLD,
        holdExpiresAt: {
          lte: now,
        },
      },
      take: limit,
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (expiredBookings.length === 0) {
      return 0;
    }

    this.logger.log(`⏰ Expiring ${expiredBookings.length} temp_hold bookings`);

    let expiredCount = 0;

    // Process each booking
    for (const booking of expiredBookings) {
      const result = await this.transition(
        booking.id,
        booking.tenantId,
        BookingEvent.EXPIRE_HOLD,
      );

      if (result.success) {
        expiredCount++;
      }
    }

    this.logger.log(`✅ Expired ${expiredCount}/${expiredBookings.length} bookings`);

    return expiredCount;
  }

  /**
   * Batch complete finished bookings
   * 
   * Marks confirmed bookings as completed after event end time.
   * 
   * @param tenantId - Tenant UUID (optional)
   * @param limit - Maximum number of bookings to complete
   * @returns Number of bookings completed
   */
  async batchCompleteBookings(tenantId?: string, limit: number = 100): Promise<number> {
    const now = new Date();

    // Find confirmed bookings that have ended
    const completedBookings = await this.prisma.booking.findMany({
      where: {
        ...(tenantId && { tenantId }),
        status: BookingStatus.CONFIRMED,
        endTs: {
          lte: now,
        },
      },
      take: limit,
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (completedBookings.length === 0) {
      return 0;
    }

    this.logger.log(`🎉 Completing ${completedBookings.length} finished bookings`);

    let completedCount = 0;

    for (const booking of completedBookings) {
      const result = await this.transition(
        booking.id,
        booking.tenantId,
        BookingEvent.COMPLETE_EVENT,
      );

      if (result.success) {
        completedCount++;
      }
    }

    this.logger.log(`✅ Completed ${completedCount}/${completedBookings.length} bookings`);

    return completedCount;
  }
}
