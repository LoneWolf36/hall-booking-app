/**
 * Approval Dialog Component
 * Modal for approving/rejecting bookings with proper UX
 * Phase5-UX-Enhancement
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from 'lucide-react';

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'approve' | 'reject' | null;
  bookingNumber?: string;
  onConfirm: (data: { notes?: string; reason?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function ApprovalDialog({
  open,
  onOpenChange,
  mode,
  bookingNumber,
  onConfirm,
  isLoading = false,
}: ApprovalDialogProps) {
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    if (mode === 'reject' && !reason.trim()) {
      return;
    }

    await onConfirm({
      notes: notes || undefined,
      reason: reason || undefined,
    });

    // Reset form
    setNotes('');
    setReason('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setNotes('');
    setReason('');
    onOpenChange(false);
  };

  if (!mode) return null;

  const isApprove = mode === 'approve';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-slate-900/95 border-slate-700/30 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <>
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                Approve Booking
              </>
            ) : (
              <>
                <XCircleIcon className="h-5 w-5 text-red-500" />
                Reject Booking
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {bookingNumber && `Booking: ${bookingNumber}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isApprove && (
            <Alert variant="destructive" className="bg-red-950/20 border-red-400/30">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                This action will notify the customer and release the booking slot.
              </AlertDescription>
            </Alert>
          )}

          {isApprove ? (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={3}
                disabled={isLoading}
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Rejection Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this booking is being rejected..."
                  rows={3}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reject-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="reject-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes..."
                  rows={2}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (!isApprove && !reason.trim())}
            isLoading={isLoading}
            className={isApprove ? 'bg-green-600 hover:bg-green-700' : ''}
            variant={isApprove ? 'default' : 'destructive'}
          >
            {isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
