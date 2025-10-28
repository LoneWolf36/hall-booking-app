// Booking related types
export enum BookingStatus {
  TEMP_HOLD = 'temp_hold',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  OWNER = 'owner',
}

// Request context
export interface RequestContext {
  tenantId: string;
  userId?: string;
  role?: UserRole;
  correlationId: string;
}

// Booking conflict response
export interface BookingConflict {
  conflictingBookings?: any[];
  alternativeDates?: string[];
  message: string;
}
