/**
 * Payment Type Definitions
 * 
 * Comprehensive types for payment processing, methods, profiles, and transactions.
 */

/**
 * Payment profiles supported by venues
 */
export type PaymentProfile = 
  | 'cash_only'        // 5% commission - Manual confirmation only
  | 'cash_deposit'     // 8% commission - Cash + mandatory deposit
  | 'hybrid'           // 8% commission - Customer choice
  | 'full_online'      // 12% commission - Online only
  | 'marketplace';     // 15% commission - Full platform management

/**
 * Payment methods available
 */
export type PaymentMethod = 
  | 'cash'
  | 'online'
  | 'razorpay'
  | 'upi'
  | 'card'
  | 'netbanking';

/**
 * Payment transaction status
 */
export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partial';

/**
 * Payment options available for a booking
 */
export interface PaymentOptions {
  bookingId: string;
  venuePaymentProfile: PaymentProfile;
  allowedMethods: PaymentMethod[];
  pricing: {
    baseAmount: number;
    taxAmount: number;
    platformFee: number;
    totalAmount: number;
    currency: string;
  };
  cashOption?: {
    available: boolean;
    discountPercentage?: number;
    finalAmount: number;
  };
  onlineOption?: {
    available: boolean;
    depositRequired: boolean;
    depositAmount?: number;
    platformFee: number;
    finalAmount: number;
  };
}

/**
 * Payment method selection DTO
 */
export interface PaymentMethodSelection {
  bookingId: string;
  paymentMethod: PaymentMethod;
  expectedAmount: number;
}

/**
 * Razorpay payment link response
 */
export interface PaymentLinkResponse {
  paymentLinkId: string;
  shortUrl: string;
  amount: number;
  currency: string;
  expiresAt: string;
  status: string;
}

/**
 * Cash payment recording DTO
 */
export interface CashPaymentRecord {
  bookingId: string;
  amountReceived: number;
  receivedBy: string;
  notes?: string;
  receiptNumber?: string;
}

/**
 * Payment transaction record
 */
export interface PaymentTransaction {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  gatewayResponse?: any;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failureReason?: string;
}

/**
 * Price breakdown for display
 */
export interface PriceBreakdown {
  subtotal: number;
  addons: number;
  tax: number;
  platformFee: number;
  discount: number;
  total: number;
  currency: string;
  items: Array<{
    label: string;
    amount: number;
    description?: string;
  }>;
}

/**
 * Commission rates by payment profile
 */
export const COMMISSION_RATES: Record<PaymentProfile, number> = {
  cash_only: 5,
  cash_deposit: 8,
  hybrid: 8,
  full_online: 12,
  marketplace: 15,
};

/**
 * Payment profile display info
 */
export const PAYMENT_PROFILE_INFO: Record<PaymentProfile, {
  label: string;
  description: string;
  commission: number;
  features: string[];
}> = {
  cash_only: {
    label: 'Cash Only',
    description: 'Traditional cash payments with manual confirmation',
    commission: 5,
    features: ['Manual confirmation', 'Pay at venue', 'Zero tech barrier'],
  },
  cash_deposit: {
    label: 'Cash + Deposit',
    description: 'Cash payment with mandatory online deposit',
    commission: 8,
    features: ['Online deposit required', 'Pay remaining at venue', 'Secure booking'],
  },
  hybrid: {
    label: 'Hybrid Flexible',
    description: 'Customer chooses cash or online payment',
    commission: 8,
    features: ['Customer choice', 'Cash discount available', 'Maximum flexibility'],
  },
  full_online: {
    label: 'Full Online',
    description: 'Complete payment online before confirmation',
    commission: 12,
    features: ['Instant confirmation', 'Full online payment', 'Digital receipts'],
  },
  marketplace: {
    label: 'Full Marketplace',
    description: 'Platform handles everything including customer service',
    commission: 15,
    features: ['Full-service', 'Platform guarantee', 'Premium support'],
  },
};
