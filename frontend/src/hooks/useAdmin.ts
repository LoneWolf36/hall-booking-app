/**
 * Admin React Query Hooks
 * 
 * Smart data fetching with caching for admin operations
 * Phase5-Integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as adminAPI from '@/lib/api/admin';

// ==================== Query Keys ====================

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  bookings: () => [...adminKeys.all, 'bookings'] as const,
  bookingsList: (filters?: any) => [...adminKeys.bookings(), 'list', filters] as const,
  booking: (id: string) => [...adminKeys.bookings(), 'detail', id] as const,
};

// ==================== Dashboard ====================

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: () => adminAPI.getDashboardStats(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // refresh every minute
  });
}

// ==================== Booking List ====================

export function useAdminBookings(params?: {
  status?: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  paymentMethod?: 'cash' | 'online' | 'partial';
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: adminKeys.bookingsList(params),
    queryFn: () => adminAPI.listBookings(params),
    staleTime: 10 * 1000, // 10 seconds
  });
}

// ==================== Booking Detail ====================

export function useBookingForReview(bookingId: string) {
  return useQuery({
    queryKey: adminKeys.booking(bookingId),
    queryFn: () => adminAPI.getBookingForReview(bookingId),
    enabled: !!bookingId,
    staleTime: 5 * 1000, // 5 seconds
  });
}

// ==================== Approve Booking ====================

export function useApproveBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, notes }: { bookingId: string; notes?: string }) =>
      adminAPI.approveBooking(bookingId, { notes }),
    
    // Optimistic update
    onMutate: async ({ bookingId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: adminKeys.booking(bookingId) });

      // Snapshot previous value
      const previous = queryClient.getQueryData(adminKeys.booking(bookingId));

      // Optimistically update
      queryClient.setQueryData(adminKeys.booking(bookingId), (old: any) => ({
        ...old,
        status: 'confirmed',
      }));

      return { previous, bookingId };
    },

    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(adminKeys.booking(context.bookingId), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to approve booking');
    },

    onSuccess: (data, variables) => {
      toast.success('Booking approved successfully');
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: adminKeys.bookingsList() });
      queryClient.setQueryData(adminKeys.booking(variables.bookingId), data);
    },
  });
}

// ==================== Reject Booking ====================

export function useRejectBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, reason, notes }: { bookingId: string; reason: string; notes?: string }) =>
      adminAPI.rejectBooking(bookingId, { reason, notes }),
    
    // Optimistic update
    onMutate: async ({ bookingId }) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.booking(bookingId) });
      const previous = queryClient.getQueryData(adminKeys.booking(bookingId));

      queryClient.setQueryData(adminKeys.booking(bookingId), (old: any) => ({
        ...old,
        status: 'rejected',
      }));

      return { previous, bookingId };
    },

    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(adminKeys.booking(context.bookingId), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to reject booking');
    },

    onSuccess: (data, variables) => {
      toast.success('Booking rejected');
      
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: adminKeys.bookingsList() });
      queryClient.setQueryData(adminKeys.booking(variables.bookingId), data);
    },
  });
}

// ==================== Record Cash Payment ====================

export function useRecordCashPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: adminAPI.RecordCashPaymentDto) =>
      adminAPI.recordCashPayment(data),

    onSuccess: (data, variables) => {
      toast.success('Payment recorded successfully');
      
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: adminKeys.booking(variables.bookingId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.bookingsList() });
    },

    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
    },
  });
}
