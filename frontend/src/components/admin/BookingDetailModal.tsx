/**
 * Booking Detail Modal
 * 
 * Comprehensive booking view with all details and actions
 * Phase5-UX-Complete
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  UserIcon,
  BuildingIcon,
  CalendarIcon,
  UsersIcon,
  CreditCardIcon,
  ClockIcon,
} from 'lucide-react';
import type { BookingForReview } from '@/lib/api/admin';
import { useApproveBooking, useRejectBooking } from '@/hooks/useAdmin';

interface BookingDetailModalProps {
  booking: BookingForReview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingDetailModal({ 
  booking, 
  open, 
  onOpenChange 
}: BookingDetailModalProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const approveMutation = useApproveBooking();
  const rejectMutation = useRejectBooking();

  if (!booking) return null;

  const handleApprove = async () => {
    await approveMutation.mutateAsync({ 
      bookingId: booking.id, 
      notes: notes || undefined 
    });
    onOpenChange(false);
    setAction(null);
    setNotes('');
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    
    await rejectMutation.mutateAsync({ 
      bookingId: booking.id, 
      reason,
      notes: notes || undefined 
    });
    onOpenChange(false);
    setAction(null);
    setReason('');
    setNotes('');
  };

  const statusConfig = {
    pending: { color: 'bg-yellow-500/20 text-yellow-500', icon: ClockIcon },
    confirmed: { color: 'bg-green-500/20 text-green-500', icon: CheckCircleIcon },
    rejected: { color: 'bg-red-500/20 text-red-500', icon: XCircleIcon },
  };

  const status = statusConfig[booking.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-xl bg-slate-900/95 border-slate-700/30">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Booking {booking.bookingNumber}</span>
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {booking.status.toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Created {format(new Date(booking.createdAt), 'PPpp')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Customer Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <UserIcon className="h-4 w-4" />
              Customer Information
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{booking.user.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{booking.user.phone}</p>
              </div>
              {booking.user.email && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{booking.user.email}</p>
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-slate-700/30" />

          {/* Venue Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BuildingIcon className="h-4 w-4" />
              Venue Information
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Venue</p>
                <p className="font-medium">{booking.venue.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Guest Count</p>
                <p className="font-medium flex items-center gap-1">
                  <UsersIcon className="h-3 w-3" />
                  {booking.guestCount || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-700/30" />

          {/* Event Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              Event Schedule
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Start Date</p>
                <p className="font-medium">{format(new Date(booking.startTs), 'PPp')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">End Date</p>
                <p className="font-medium">{format(new Date(booking.endTs), 'PPp')}</p>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-700/30" />

          {/* Payment Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCardIcon className="h-4 w-4" />
              Payment Information
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg">
                  ₹{((booking.totalAmountCents || 0) / 100).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment Method</p>
                <p className="font-medium capitalize">{booking.paymentMethod || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Action Section */}
          {booking.status === 'pending' && (
            <>
              <Separator className="bg-slate-700/30" />
              
              {!action && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => setAction('approve')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Approve Booking
                  </Button>
                  <Button
                    onClick={() => setAction('reject')}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircleIcon className="h-4 w-4 mr-2" />
                    Reject Booking
                  </Button>
                </div>
              )}

              {action === 'approve' && (
                <div className="space-y-4 p-4 bg-green-950/20 border border-green-400/30 rounded-lg">
                  <div className="space-y-2">
                    <Label>Approval Notes (Optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this approval..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      isLoading={approveMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      Confirm Approval
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAction(null);
                        setNotes('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {action === 'reject' && (
                <div className="space-y-4 p-4 bg-red-950/20 border border-red-400/30 rounded-lg">
                  <div className="space-y-2">
                    <Label>Rejection Reason *</Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why this booking is being rejected..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Additional Notes (Optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any additional notes..."
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReject}
                      disabled={!reason.trim() || rejectMutation.isPending}
                      isLoading={rejectMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      Confirm Rejection
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAction(null);
                        setReason('');
                        setNotes('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
