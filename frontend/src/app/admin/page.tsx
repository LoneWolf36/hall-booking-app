/**
 * Admin Dashboard Page
 * 
 * Fully integrated with backend APIs and smart caching
 * Phase5-Complete-Integration
 */

'use client';

import { Suspense, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListSkeleton, CardSkeleton } from '@/components/ui/loading-skeleton';
import { useAdminDashboard, useAdminBookings, useApproveBooking, useRejectBooking } from '@/hooks/useAdmin';
import { BookingTable } from '@/components/admin/BookingTable';
import { ApprovalDialog } from '@/components/admin/ApprovalDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, AlertTriangleIcon } from 'lucide-react';

function AdminDashboardContent() {
  const [selectedTab, setSelectedTab] = useState<'pending' | 'confirmed' | 'rejected'>('pending');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dialog state
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    mode: 'approve' | 'reject' | null;
    bookingId: string | null;
    bookingNumber: string | null;
  }>({ open: false, mode: null, bookingId: null, bookingNumber: null });

  // Fetch dashboard stats with auto-refresh
  const { data: stats, isLoading: statsLoading, error: statsError } = useAdminDashboard();

  // Fetch bookings list with filters
  const bookingsParams = useMemo(() => ({
    status: selectedTab,
    paymentMethod: filterPaymentMethod === 'all' ? undefined : filterPaymentMethod as 'cash' | 'online',
    search: searchQuery || undefined,
    page: currentPage,
    limit: 10,
  }), [selectedTab, filterPaymentMethod, searchQuery, currentPage]);

  const { data: bookingsData, isLoading: bookingsLoading, error: bookingsError } = useAdminBookings(bookingsParams);

  // Mutations
  const approveMutation = useApproveBooking();
  const rejectMutation = useRejectBooking();

  // Handle approval/rejection
  const handleApprovalConfirm = async (data: { notes?: string; reason?: string }) => {
    if (!approvalDialog.bookingId) return;

    if (approvalDialog.mode === 'approve') {
      await approveMutation.mutateAsync({
        bookingId: approvalDialog.bookingId,
        notes: data.notes,
      });
    } else if (approvalDialog.mode === 'reject') {
      await rejectMutation.mutateAsync({
        bookingId: approvalDialog.bookingId,
        reason: data.reason!,
        notes: data.notes,
      });
    }
  };

  // Error state
  if (statsError || bookingsError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            Failed to load admin dashboard. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage bookings, approvals, and payments
        </p>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="backdrop-blur-xl bg-slate-900/40 border-slate-700/30 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingBookings || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting review
              </p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-slate-900/40 border-slate-700/30 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confirmed Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.confirmedBookings || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                This month
              </p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-slate-900/40 border-slate-700/30 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rejected Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.rejectedBookings || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Declined
              </p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-slate-900/40 border-slate-700/30 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{((stats?.totalCashPayments || 0) + (stats?.totalOnlinePayments || 0)).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All payments
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bookings Management */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-slate-700/30 shadow-lg">
        <CardHeader>
          <CardTitle>Booking Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending">
                Pending ({stats?.pendingBookings || 0})
              </TabsTrigger>
              <TabsTrigger value="confirmed">
                Confirmed ({stats?.confirmedBookings || 0})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({stats?.rejectedBookings || 0})
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Input
                placeholder="Search by booking ID or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Booking Lists */}
            <TabsContent value={selectedTab} className="space-y-4 mt-6">
              {bookingsLoading ? (
                <ListSkeleton rows={3} />
              ) : bookingsData && bookingsData.data.length > 0 ? (
                <div className="space-y-4">
                  <BookingTable
                    bookings={bookingsData.data}
                    onViewDetails={(id) => console.log('View details:', id)}
                    onApprove={(id) => {
                      const booking = bookingsData.data.find(b => b.id === id);
                      setApprovalDialog({
                        open: true,
                        mode: 'approve',
                        bookingId: id,
                        bookingNumber: booking?.bookingNumber || null,
                      });
                    }}
                    onReject={(id) => {
                      const booking = bookingsData.data.find(b => b.id === id);
                      setApprovalDialog({
                        open: true,
                        mode: 'reject',
                        bookingId: id,
                        bookingNumber: booking?.bookingNumber || null,
                      });
                    }}
                  />

                  {/* Pagination Info */}
                  <div className="flex justify-between items-center pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {bookingsData.data.length} of {bookingsData.total} bookings
                    </p>
                    {bookingsData.total > 10 && (
                      <div className="text-sm text-muted-foreground">
                        Page {bookingsData.page} of {Math.ceil(bookingsData.total / 10)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <InfoIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No {selectedTab} bookings found</p>
                  {searchQuery && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your search or filters
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <ApprovalDialog
        open={approvalDialog.open}
        onOpenChange={(open) => setApprovalDialog(prev => ({ ...prev, open }))}
        mode={approvalDialog.mode}
        bookingNumber={approvalDialog.bookingNumber || undefined}
        onConfirm={handleApprovalConfirm}
        isLoading={approveMutation.isPending || rejectMutation.isPending}
      />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
