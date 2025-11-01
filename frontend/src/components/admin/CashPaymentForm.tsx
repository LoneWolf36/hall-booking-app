/**
 * Cash Payment Form Component
 * 
 * Form for recording cash payments and generating receipts.
 * Phase5-UI-017
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSignIcon, CheckIcon, Loader2Icon } from 'lucide-react';
import { useRecordCashPayment } from '@/hooks/useAdmin';

export interface CashPaymentFormProps {
  bookingId: string;
  bookingNumber: string;
  totalAmount: number;
  paidAmount?: number;
  onSubmit: (
    bookingId: string,
    paidAmount: number,
    notes?: string
  ) => Promise<void>;
}

/**
 * Cash payment recording form
 */
export function CashPaymentForm({
  bookingId,
  bookingNumber,
  totalAmount,
  paidAmount = 0,
  onSubmit,
}: CashPaymentFormProps) {
  const [amount, setAmount] = useState(paidAmount.toString());
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const recordPaymentMutation = useRecordCashPayment();

  const parsedAmount = parseInt(amount) || 0;
  const remaining = totalAmount - parsedAmount;
  const isFullPayment = parsedAmount >= totalAmount;

  const handleSubmit = async () => {
    if (parsedAmount <= 0) {
      return;
    }

    await recordPaymentMutation.mutateAsync({
      bookingId,
      paidAmount: parsedAmount,
      notes: notes || undefined,
    });
    
    setSubmitted(true);
    setAmount('');
    setNotes('');
    
    if (onSubmit) {
      await onSubmit(bookingId, parsedAmount, notes);
    }
  };

  if (submitted) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-slate-700/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-400">
            <CheckIcon className="h-5 w-5" />
            Payment Recorded
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Booking {bookingNumber} - ₹{parsedAmount.toLocaleString()} recorded successfully
          </p>
          <Button onClick={() => setSubmitted(false)} variant="outline">
            Record Another Payment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-slate-700/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSignIcon className="h-5 w-5" />
          Record Cash Payment
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Booking Summary */}
        <div className="p-4 bg-slate-950/50 border border-slate-700/30 rounded-lg space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Booking ID</span>
            <span className="font-medium">{bookingNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-medium">₹{totalAmount.toLocaleString()}</span>
          </div>
          {paidAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already Paid</span>
              <span className="font-medium">₹{paidAmount.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Payment Input */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount Received (₹)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              ₹
            </span>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="pl-7"
              disabled={recordPaymentMutation.isPending}
            />
          </div>
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground">
              Remaining: ₹{remaining.toLocaleString()}
            </p>
          )}
        </div>

        {/* Status Alert */}
        {isFullPayment && (
          <Alert className="bg-green-950/20 border-green-400/30">
            <CheckIcon className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-300">
              Full payment amount reached
            </AlertDescription>
          </Alert>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any payment notes (e.g., 'Card payment method', 'Check #1234')..."
            rows={3}
            disabled={recordPaymentMutation.isPending}
          />
        </div>

        {/* Action Buttons */}
        <Button
          onClick={handleSubmit}
          disabled={parsedAmount <= 0 || recordPaymentMutation.isPending}
          isLoading={recordPaymentMutation.isPending}
          className="w-full"
          size="lg"
        >
          Record Payment
        </Button>
      </CardContent>
    </Card>
  );
}
