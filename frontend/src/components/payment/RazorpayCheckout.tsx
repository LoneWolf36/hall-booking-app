// CRIT-002: Razorpay Payment Integration - Frontend Component
// Complete Razorpay checkout integration with React hooks and error handling

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, Shield, CheckCircle } from 'lucide-react';

// Razorpay SDK types
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutProps {
  bookingId: string;
  amount: number; // in paise (₹1 = 100 paise)
  currency?: string;
  token?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  onSuccess?: (paymentData: RazorpayResponse) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export default function RazorpayCheckout({
  bookingId,
  amount,
  currency = 'INR',
  token,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  onError,
  onCancel,
}: RazorpayCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => setError('Failed to load payment gateway');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const createRazorpayOrder = async (): Promise<RazorpayOrder> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        bookingId,
        amount,
        currency,
        receipt: `booking_${bookingId}`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create payment order');
    }

    return response.json();
  };

  const verifyPayment = async (paymentData: RazorpayResponse): Promise<void> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        bookingId,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_signature: paymentData.razorpay_signature,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Payment verification failed');
    }
  };

  const initiatePayment = async () => {
    if (!isScriptLoaded) {
      setError('Payment gateway not loaded. Please refresh the page.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPaymentStatus('processing');

    try {
      // Step 1: Create Razorpay order on server
      const order = await createRazorpayOrder();

      // Step 2: Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Hall Booking',
        description: `Booking payment for booking #${bookingId.slice(0, 8)}`,
        order_id: order.id,
        handler: async (response: RazorpayResponse) => {
          try {
            // Step 3: Verify payment on server
            await verifyPayment(response);
            setPaymentStatus('success');
            onSuccess?.(response);
          } catch (error) {
            console.error('Payment verification failed:', error);
            setPaymentStatus('failed');
            setError(error instanceof Error ? error.message : 'Payment verification failed');
            onError?.(error as Error);
          }
        },
        prefill: {
          name: customerName || '',
          email: customerEmail || '',
          contact: customerPhone || '',
        },
        theme: {
          color: '#6366f1', // Indigo-500 matching app theme
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
            setPaymentStatus('idle');
            onCancel?.();
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment initiation failed:', error);
      setPaymentStatus('failed');
      setError(error instanceof Error ? error.message : 'Payment failed');
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-full">
            <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
        <CardTitle className="text-xl font-semibold">
          Secure Payment
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Complete your booking with Razorpay's secure payment gateway
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Payment Amount Display */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Amount to pay</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            ₹{(amount / 100).toLocaleString('en-IN')}
          </p>
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>256-bit SSL encrypted</span>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Display */}
        {paymentStatus === 'success' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Payment successful! Redirecting to confirmation...
            </AlertDescription>
          </Alert>
        )}

        {/* Payment Button */}
        <Button
          onClick={initiatePayment}
          disabled={isLoading || !isScriptLoaded || paymentStatus === 'success'}
          className="w-full h-12 text-base font-medium"
          size="lg"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {paymentStatus === 'processing' && 'Processing...'}
          {paymentStatus === 'success' && 'Payment Successful'}
          {paymentStatus === 'idle' && `Pay ₹${(amount / 100).toLocaleString('en-IN')}`}
          {paymentStatus === 'failed' && 'Retry Payment'}
        </Button>

        {/* Supported Payment Methods */}
        <div className="text-center text-xs text-muted-foreground">
          <p>We accept: Credit/Debit Cards, UPI, Net Banking, Wallets</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Payment Service Functions
export class PaymentApiService {
  private apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  async getPaymentOptions(bookingId: string, token: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/payments/bookings/${bookingId}/options`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to get payment options');
    return response.json();
  }

  async selectPaymentMethod(bookingId: string, method: string, token: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/payments/bookings/${bookingId}/select-method`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ paymentMethod: method }),
    });
    
    if (!response.ok) throw new Error('Failed to select payment method');
    return response.json();
  }

  async createPaymentLink(bookingId: string, token: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/payments/bookings/${bookingId}/payment-link`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to create payment link');
    return response.json();
  }
}

export const paymentService = new PaymentApiService();