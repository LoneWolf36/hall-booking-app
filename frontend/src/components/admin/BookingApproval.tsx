/**
 * Booking Approval Component
 * 
 * UI for approving or rejecting pending bookings.
 * Phase5-UI-017
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckIcon, XIcon, AlertTriangleIcon } from 'lucide-react';
import { toast } from 'sonner';

export interface BookingApprovalProps {
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  venueName: string;
  eventDate: string;
  guestCount: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'online';
  status: 'pending' | 'temp_hold';
  onApprove: (bookingId: string, notes?: string) => Promise<void>;
  onReject: (bookingId: string, reason: string) => Promise<void>;
}

/**
 * Booking approval dialog
 */
export function BookingApproval({
  bookingId,
  bookingNumber,
  customerName,
  customerPhone,
  venueName,
  eventDate,
  guestCount,
  totalAmount,
  paymentMethod,
  status,
  onApprove,
  onReject,
}: BookingApprovalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await onApprove(bookingId, notes);
      toast.success('Booking approved');
      setAction(null);
      setNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setIsLoading(true);
    try {
      await onReject(bookingId, reason);
      toast.success('Booking rejected');
      setAction(null);
      setReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-slate-700/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Booking {bookingNumber}</span>
          <span className="text-sm font-normal text-muted-foreground">{status}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Booking Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Customer</p>
            <p className="font-medium">{customerName}</p>
            <p className="text-xs text-muted-foreground">{customerPhone}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Venue</p>
            <p className="font-medium">{venueName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Event Date</p>
            <p className="font-medium">{eventDate}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Guests</p>
            <p className="font-medium">{guestCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-medium">₹{totalAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Payment</p>
            <p className="font-medium capitalize">{paymentMethod}</p>
          </div>
        </div>

        {/* Action Selection */}
        {!action && (
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setAction('approve')}
              disabled={isLoading}
            >
              <CheckIcon className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setAction('reject')}
              disabled={isLoading}
            >
              <XIcon className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}

        {/* Approval Form */}
        {action === 'approve' && (
          <div className="space-y-4 p-4 bg-green-950/20 border border-green-400/30 rounded-lg">
            <div>
              <Label htmlFor="approve-notes">Notes (optional)</Label>
              <Textarea
                id="approve-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                className="mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={isLoading}
                isLoading={isLoading}
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
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Rejection Form */}
        {action === 'reject' && (
          <div className="space-y-4 p-4 bg-red-950/20 border border-red-400/30 rounded-lg">
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                Rejecting this booking will notify the customer and release the booking slot.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="reject-reason">Rejection Reason</Label>
              <Textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this booking is being rejected..."
                className="mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleReject}
                disabled={isLoading || !reason.trim()}
                isLoading={isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Confirm Rejection
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAction(null);
                  setReason('');
                }}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
