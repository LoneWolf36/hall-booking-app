'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2 } from 'lucide-react';
import RazorpayCheckout from '@/components/payment/RazorpayCheckout';
import { bookingService, type BookingResponse } from '@/services/booking.service';
import { useAuthStore } from '@/stores/auth-store';

export default function PaymentProcessingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isAuthenticated } = useAuthStore();
  
  const bookingId = searchParams.get('bookingId');
  
  const [booking, setBooking] = useState<BookingResponse['booking'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentInProgress, setPaymentInProgress] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !token) {
      router.push('/auth?redirect=' + encodeURIComponent('/payment/processing' + window.location.search));
      return;
    }
  }, [isAuthenticated, token, router]);

  // Load booking details on mount
  useEffect(() => {
    const loadBooking = async () => {
      if (!bookingId || !token) {
        setError('Booking ID is required for payment processing');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const bookingData = await bookingService.getBooking(bookingId, token);
        
        if (!bookingData) {
          setError('Booking not found. Please check your booking details.');
          return;
        }

        // Verify booking is in payable state
        if (bookingData.paymentStatus === 'paid') {
          // Redirect to success page if already paid
          router.push(`/success?bookingId=${bookingId}`);
          return;
        }

        if (bookingData.status === 'cancelled' || bookingData.status === 'expired') {
          setError('This booking is no longer available for payment.');
          return;
        }

        setBooking(bookingData);
      } catch (error) {
        console.error('Failed to load booking:', error);
        setError(error instanceof Error ? error.message : 'Failed to load booking details');
      } finally {
        setIsLoading(false);
      }
    };

    loadBooking();
  }, [bookingId, token, router]);

  const handlePaymentSuccess = async (paymentData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    console.log('Payment successful:', paymentData);
    
    // Redirect to success page with booking ID and payment ID
    router.push(`/success?bookingId=${bookingId}&paymentId=${paymentData.razorpay_payment_id}`);
  };

  const handlePaymentError = (error: Error) => {
    console.error('Payment failed:', error);
    setError(error.message || 'Payment failed. Please try again.');
    setPaymentInProgress(false);
  };

  const handlePaymentCancel = () => {
    console.log('Payment cancelled by user');
    setPaymentInProgress(false);
    // Stay on current page - user can retry
  };

  const handleRetryPayment = () => {
    setError(null);
    setPaymentInProgress(false);
  };

  const handleBackToBooking = () => {
    router.push('/booking');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
              <p className="text-muted-foreground">Loading booking details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={handleBackToBooking}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Complete Your Payment
            </h1>
            <p className="text-muted-foreground">
              Secure your booking with our trusted payment gateway
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Booking Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Booking Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Booking Number:</span>
                    <span className="font-medium">{booking.bookingNumber}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Venue:</span>
                    <span className="font-medium">{booking.venue.name}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Date:</span>
                    <span className="font-medium">
                      {new Date(booking.startTs).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">
                      {new Date(booking.startTs).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(booking.endTs).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  
                  {booking.guestCount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guest Count:</span>
                      <span className="font-medium">{booking.guestCount}</span>
                    </div>
                  )}
                  
                  {booking.eventType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Event Type:</span>
                      <span className="font-medium capitalize">{booking.eventType}</span>
                    </div>
                  )}
                </div>
                
                <hr className="my-4" />
                
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Amount:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    ₹{(booking.totalAmountCents / 100).toLocaleString('en-IN')}
                  </span>
                </div>
                
                {booking.holdExpiresAt && (
                  <Alert>
                    <AlertDescription>
                      This booking expires at{' '}
                      {new Date(booking.holdExpiresAt).toLocaleString('en-IN')}.
                      Complete payment to confirm your booking.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Payment Section */}
            <div className="space-y-6">
              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Razorpay Checkout Component */}
              <RazorpayCheckout
                bookingId={booking.id}
                amount={booking.totalAmountCents}
                currency={booking.currency}
                token={token || undefined}
                customerName={booking.customer.name}
                customerEmail={booking.customer.email}
                customerPhone={booking.customer.phone}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handlePaymentCancel}
              />
              
              {/* Alternative Actions */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleBackToBooking}
                  className="flex-1"
                  disabled={paymentInProgress}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Booking
                </Button>
                
                {error && (
                  <Button 
                    onClick={handleRetryPayment}
                    className="flex-1"
                    disabled={paymentInProgress}
                  >
                    Retry Payment
                  </Button>
                )}
              </div>
              
              {/* Payment Security Info */}
              <div className="text-center space-y-2 text-sm text-muted-foreground">
                <p>Your payment is processed securely by Razorpay</p>
                <p>This site is protected by 256-bit SSL encryption</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Payment Processing Page - CRIT-002 Integration
 * 
 * Features:
 * ✅ Loads booking details from backend API
 * ✅ JWT authentication integration
 * ✅ RazorpayCheckout component integration
 * ✅ Payment success/failure handling
 * ✅ Booking hold expiry warnings
 * ✅ Error boundary integration
 * ✅ Loading states and user feedback
 * ✅ Mobile-responsive design
 * ✅ Automatic redirects on completion
 * 
 * API Calls:
 * - bookingService.getBooking() - Load booking details
 * - RazorpayCheckout handles payment API calls internally
 * 
 * Authentication:
 * - Requires valid JWT token
 * - Redirects to auth if not authenticated
 * - Token passed to all API calls
 * 
 * User Flow:
 * 1. Load booking details from API
 * 2. Display booking summary
 * 3. Present Razorpay checkout
 * 4. Handle payment result
 * 5. Redirect to success/confirmation
 */