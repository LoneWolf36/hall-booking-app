/**
 * Payments API Service
 * Handles payment-related API calls
 */

import { apiGet, apiPost, ApiResponse } from './client';

export interface PaymentOptionsResponseDto {
  bookingId: string;
  options: Array<{
    id: string;
    name: string;
    description: string;
    paymentMethod: string;
    paymentProfile: string;
    onlineAmount: number;
    cashAmount: number;
    depositAmount?: number;
    processingFee: number;
    totalAmount: number;
    dueDate: string;
    recommended: boolean;
  }>;
  venuePaymentProfile: string;
}

export interface SelectPaymentMethodDto {
  paymentMethod: 'cash' | 'online' | 'deposit_then_cash';
  paymentProfile: string;
}

export interface PaymentLinkResponseDto {
  paymentLinkId: string;
  bookingId: string;
  amount: number;
  currency: string;
  shortUrl: string;
  longUrl: string;
  expiresAt: string;
  status: string;
}

export interface RecordCashPaymentDto {
  amountCents: number;
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer';
  receiptNumber?: string;
  notes?: string;
}

export interface VenuePaymentConfigDto {
  paymentProfile: string;
  allowCashPayments: boolean;
  cashDiscountPercentage: number;
  requiresOnlineDeposit: boolean;
  depositType?: string;
  depositAmount?: number;
  hasRazorpayAccount: boolean;
  platformHandlesPayments: boolean;
  confirmationTrigger?: string;
  platformCommissionPercentage: number;
  paymentDueDaysBeforeEvent: number;
}

export interface CommissionSummaryDto {
  venueId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  totalBookingAmount: number;
  totalCommission: number;
  commissionRate: number;
  collected: number;
  pending: number;
  summary: Array<{
    month: string;
    bookingAmount: number;
    commission: number;
    collected: number;
  }>;
}

/**
 * Get payment options for booking
 */
export async function getPaymentOptions(
  bookingId: string,
  location?: string,
  token?: string
) {
  const params = new URLSearchParams();
  if (location) params.append('location', location);

  return apiGet<PaymentOptionsResponseDto>(
    `/payments/bookings/${bookingId}/options?${params.toString()}`,
    token
  );
}

/**
 * Select payment method for booking
 */
export async function selectPaymentMethod(
  bookingId: string,
  selection: SelectPaymentMethodDto,
  token?: string
) {
  return apiPost<any>(
    `/payments/bookings/${bookingId}/select-method`,
    selection,
    token
  );
}

/**
 * Create payment link for online payment
 */
export async function createPaymentLink(
  bookingId: string,
  token?: string
) {
  return apiPost<PaymentLinkResponseDto>(
    `/payments/bookings/${bookingId}/payment-link`,
    {},
    token
  );
}

/**
 * Record cash payment
 */
export async function recordCashPayment(
  bookingId: string,
  paymentData: RecordCashPaymentDto,
  token?: string
) {
  return apiPost<any>(
    `/payments/bookings/${bookingId}/cash-payment`,
    paymentData,
    token
  );
}

/**
 * Get cash payment summary
 */
export async function getCashPaymentSummary(
  bookingId: string,
  token?: string
) {
  return apiGet<any>(
    `/payments/bookings/${bookingId}/cash-summary`,
    token
  );
}

/**
 * Get venue payment configuration
 */
export async function getVenuePaymentConfig(
  venueId: string,
  token?: string
) {
  return apiGet<VenuePaymentConfigDto>(
    `/payments/venues/${venueId}/configuration`,
    token
  );
}

/**
 * Get commission summary for venue
 */
export async function getCommissionSummary(
  venueId: string,
  startDate?: string,
  endDate?: string,
  token?: string
) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  return apiGet<CommissionSummaryDto>(
    `/payments/venues/${venueId}/commission-summary?${params.toString()}`,
    token
  );
}

/**
 * Get payment details by ID
 */
export async function getPaymentDetails(
  paymentId: string,
  token?: string
) {
  return apiGet<any>(
    `/payments/${paymentId}`,
    token
  );
}

/**
 * Get payment history for booking
 */
export async function getPaymentHistory(
  bookingId: string,
  token?: string
) {
  return apiGet<{
    bookingId: string;
    totalAmount: number;
    totalPaid: number;
    remainingAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    payments: Array<any>;
    commission: Array<any>;
  }>(
    `/payments/bookings/${bookingId}/history`,
    token
  );
}
