/**
 * Admin API Service
 * 
 * Endpoints for admin operations: dashboard, approvals, payments
 * Phase5-Integration
 */

import { apiGet, apiPost } from './client';

// ==================== Types ====================

export interface AdminDashboardStats {
  pendingBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  totalCashPayments?: number;
  totalOnlinePayments?: number;
}

export interface BookingForReview {
  id: string;
  bookingNumber: string;
  status: string;
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  venue: {
    id: string;
    name: string;
  };
  startTs: string;
  endTs: string;
  guestCount?: number;
  totalAmountCents?: number;
  paymentMethod?: string;
  createdAt: string;
}

export interface AdminBookingListResponse {
  data: BookingForReview[];
  total: number;
  page: number;
  limit: number;
}

export interface ApproveBookingDto {
  notes?: string;
}

export interface RejectBookingDto {
  reason: string;
  notes?: string;
}

export interface RecordCashPaymentDto {
  bookingId: string;
  paidAmount: number;
  notes?: string;
}

// ==================== API Calls ====================

/**
 * Get admin dashboard statistics
 */
export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const response = await apiGet<AdminDashboardStats>('/admin/dashboard');
  return response.data!;
}

/**
 * Get booking details for admin review
 */
export async function getBookingForReview(bookingId: string): Promise<BookingForReview> {
  const response = await apiGet<BookingForReview>(`/admin/bookings/${bookingId}`);
  return response.data!;
}

/**
 * Approve a pending booking
 */
export async function approveBooking(
  bookingId: string,
  data: ApproveBookingDto = {}
): Promise<BookingForReview> {
  const response = await apiPost<BookingForReview>(`/admin/bookings/${bookingId}/approve`, data);
  return response.data!;
}

/**
 * Reject a pending booking
 */
export async function rejectBooking(
  bookingId: string,
  data: RejectBookingDto
): Promise<BookingForReview> {
  const response = await apiPost<BookingForReview>(`/admin/bookings/${bookingId}/reject`, data);
  return response.data!;
}

/**
 * Record a cash payment
 */
export async function recordCashPayment(
  data: RecordCashPaymentDto
): Promise<{ id: string; amount: number; method: string }> {
  const response = await apiPost(`/admin/payments/cash`, data);
  return response.data!;
}

/**
 * List bookings with filters
 */
export async function listBookings(params?: {
  status?: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  paymentMethod?: 'cash' | 'online' | 'partial';
  search?: string;
  page?: number;
  limit?: number;
}): Promise<AdminBookingListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.status) queryParams.append('status', params.status);
  if (params?.paymentMethod) queryParams.append('paymentMethod', params.paymentMethod);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const query = queryParams.toString();
  const response = await apiGet<AdminBookingListResponse>(`/admin/bookings${query ? `?${query}` : ''}`);
  return response.data!;
}
