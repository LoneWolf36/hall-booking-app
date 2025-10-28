/**
 * Booking State Machine - State Definitions and Transitions
 * 
 * This defines the complete finite state machine for booking lifecycle.
 */

/**
 * Booking Status Enum
 * Matches Prisma schema BookingStatus
 */
export enum BookingStatus {
  TEMP_HOLD = 'temp_hold',      // Initial state - expires in 30 mins
  PENDING = 'pending',            // Awaiting confirmation/payment
  CONFIRMED = 'confirmed',        // Booking confirmed and ready
  CANCELLED = 'cancelled',        // User or admin cancelled
  EXPIRED = 'expired',            // temp_hold expired
  COMPLETED = 'completed',        // Event finished successfully
}

/**
 * Booking State Transition Events
 */
export enum BookingEvent {
  CREATE = 'create',                      // Initial creation
  EXPIRE_HOLD = 'expire_hold',           // temp_hold timeout (30 mins)
  SELECT_PAYMENT = 'select_payment',     // Customer selects payment method
  RECEIVE_DEPOSIT = 'receive_deposit',   // Online deposit received
  RECEIVE_FULL_PAYMENT = 'receive_full_payment', // Full online payment received
  MANUAL_CONFIRM = 'manual_confirm',     // Admin/staff manually confirms
  CANCEL = 'cancel',                     // User cancels
  ADMIN_CANCEL = 'admin_cancel',         // Admin cancels
  COMPLETE_EVENT = 'complete_event',     // Event date passed successfully
}

/**
 * State Transition Definition
 */
export interface StateTransition {
  from: BookingStatus;
  to: BookingStatus;
  event: BookingEvent;
  condition?: (context: BookingContext) => boolean;
  onTransition?: (context: BookingContext) => Promise<void>;
}

/**
 * Booking Context for State Transitions
 */
export interface BookingContext {
  bookingId: string;
  tenantId: string;
  currentStatus: BookingStatus;
  venuePaymentProfile?: string;
  confirmationTrigger?: string;
  paymentStatus?: string;
  confirmedBy?: string;
  metadata?: Record<string, any>;
}

/**
 * Complete Booking State Machine Definition
 * 
 * **State Flow**:
 * ```
 * temp_hold (30min) ──┬→ expired
 *                     └→ pending ──┬→ confirmed ──→ completed
 *                                  └→ cancelled
 * ```
 * 
 * **Confirmation Triggers** (from venue.confirmationTrigger):
 * - `manual_approval`: Requires admin confirmation (cash-only venues)
 * - `deposit_only`: Auto-confirm on deposit received
 * - `full_payment`: Auto-confirm on full payment received
 * - `immediate`: Auto-confirm immediately (free venues)
 */
export const BOOKING_STATE_MACHINE: StateTransition[] = [
  // ═══════════════════════════════════════════════════════════
  // FROM: TEMP_HOLD
  // ═══════════════════════════════════════════════════════════
  {
    from: BookingStatus.TEMP_HOLD,
    to: BookingStatus.EXPIRED,
    event: BookingEvent.EXPIRE_HOLD,
    condition: (ctx) => {
      // Auto-expire after 30 minutes
      return true; // Checked by background job based on holdExpiresAt
    },
  },
  {
    from: BookingStatus.TEMP_HOLD,
    to: BookingStatus.PENDING,
    event: BookingEvent.SELECT_PAYMENT,
    condition: (ctx) => {
      // Customer selected payment method
      return true;
    },
  },
  {
    from: BookingStatus.TEMP_HOLD,
    to: BookingStatus.CANCELLED,
    event: BookingEvent.CANCEL,
  },

  // ═══════════════════════════════════════════════════════════
  // FROM: PENDING
  // ═══════════════════════════════════════════════════════════
  {
    from: BookingStatus.PENDING,
    to: BookingStatus.CONFIRMED,
    event: BookingEvent.MANUAL_CONFIRM,
    condition: (ctx) => {
      // Manual confirmation requires confirmedBy
      return !!ctx.confirmedBy;
    },
  },
  {
    from: BookingStatus.PENDING,
    to: BookingStatus.CONFIRMED,
    event: BookingEvent.RECEIVE_DEPOSIT,
    condition: (ctx) => {
      // Auto-confirm on deposit if venue allows
      return ctx.confirmationTrigger === 'deposit_only';
    },
  },
  {
    from: BookingStatus.PENDING,
    to: BookingStatus.CONFIRMED,
    event: BookingEvent.RECEIVE_FULL_PAYMENT,
    condition: (ctx) => {
      // Auto-confirm on full payment
      return ctx.confirmationTrigger === 'full_payment';
    },
  },
  {
    from: BookingStatus.PENDING,
    to: BookingStatus.CANCELLED,
    event: BookingEvent.CANCEL,
  },
  {
    from: BookingStatus.PENDING,
    to: BookingStatus.CANCELLED,
    event: BookingEvent.ADMIN_CANCEL,
  },

  // ═══════════════════════════════════════════════════════════
  // FROM: CONFIRMED
  // ═══════════════════════════════════════════════════════════
  {
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.COMPLETED,
    event: BookingEvent.COMPLETE_EVENT,
    condition: (ctx) => {
      // Event date has passed
      return true; // Checked by background job based on endTs
    },
  },
  {
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.CANCELLED,
    event: BookingEvent.CANCEL,
  },
  {
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.CANCELLED,
    event: BookingEvent.ADMIN_CANCEL,
  },
];

/**
 * Valid state transitions lookup
 * For quick validation in services
 */
export const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.TEMP_HOLD]: [
    BookingStatus.PENDING,
    BookingStatus.EXPIRED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.PENDING]: [
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.CANCELLED]: [],  // Terminal state
  [BookingStatus.EXPIRED]: [],    // Terminal state
  [BookingStatus.COMPLETED]: [],  // Terminal state
};

/**
 * Terminal states (no further transitions possible)
 */
export const TERMINAL_STATES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.EXPIRED,
  BookingStatus.COMPLETED,
];

/**
 * Booking lifecycle durations (in seconds)
 */
export const BOOKING_TIMEOUTS = {
  TEMP_HOLD_DURATION: 30 * 60,        // 30 minutes
  GRACE_PERIOD: 5 * 60,                // 5 minutes grace before hard expiry
  PENDING_PAYMENT_REMINDER: 24 * 60 * 60, // 24 hours for payment reminder
};

/**
 * Confirmation trigger mapping from venue payment profile
 */
export const CONFIRMATION_TRIGGER_MAP: Record<string, string> = {
  cash_only: 'manual_approval',
  cash_deposit: 'deposit_only',
  hybrid: 'deposit_only',
  full_online: 'full_payment',
  marketplace: 'full_payment',
};
