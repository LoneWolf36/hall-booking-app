'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/stores/booking-store';
import { Loader2Icon, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PaymentProcessingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progress, setProgress] = useState(0);

  const {
    paymentMethod,
    selectedVenue,
    selectedDate,
    eventType,
    guestCount,
    totalAmount,
  } = useBookingStore();

  useEffect(() => {
    // Validate booking data exists
    if (!selectedVenue || !selectedDate || !eventType || !paymentMethod) {
      setStatus('error');
      setErrorMessage('Missing booking information. Please restart your booking.');
      return;
    }

    // Simulate payment processing stages
    const processPayment = async () => {
      try {
        // Stage 1: Initializing (0-25%)
        setProgress(15);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Stage 2: Verifying details (25-50%)
        setProgress(35);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Stage 3: Processing payment (50-75%)
        setProgress(60);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 4: Confirming booking (75-100%)
        setProgress(85);
        await new Promise(resolve => setTimeout(resolve, 800));

        setProgress(100);
        setStatus('success');
        
        // Navigate to success page after brief delay
        setTimeout(() => {
          router.push('/success');
        }, 1500);

      } catch (error) {
        setStatus('error');
        setErrorMessage('Payment processing failed. Please try again.');
        console.error('Payment processing error:', error);
      }
    };

    processPayment();
  }, [selectedVenue, selectedDate, eventType, paymentMethod, router]);

  const handleRetry = () => {
    router.push('/confirmation');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-6 sm:py-8 md:py-12 px-3 sm:px-4 md:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        {/* Processing Card */}
        <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-2xl border-border/40 shadow-2xl">
          <CardContent className="p-8 sm:p-12">
            <div className="text-center space-y-8">
              {/* Status Icon */}
              <div className="flex justify-center">
                {status === 'processing' && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                      <Loader2Icon className="h-12 w-12 text-primary animate-spin" />
                    </div>
                  </div>
                )}
                
                {status === 'success' && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-500/30 to-green-500/10 flex items-center justify-center">
                      <CheckCircle2Icon className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                )}
                
                {status === 'error' && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-destructive/30 to-destructive/10 flex items-center justify-center">
                      <AlertCircleIcon className="h-12 w-12 text-destructive" />
                    </div>
                  </div>
                )}
              </div>

              {/* Status Message */}
              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {status === 'processing' && 'Processing Your Payment'}
                  {status === 'success' && 'Payment Successful!'}
                  {status === 'error' && 'Payment Failed'}
                </h1>
                
                <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
                  {status === 'processing' && 'Please wait while we securely process your payment and confirm your booking...'}
                  {status === 'success' && 'Your booking has been confirmed. Redirecting to confirmation page...'}
                  {status === 'error' && errorMessage}
                </p>
              </div>

              {/* Progress Bar */}
              {status === 'processing' && (
                <div className="space-y-2">
                  <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-primary to-primary/80 h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{progress}% complete</p>
                </div>
              )}

              {/* Payment Details Summary */}
              {status === 'processing' && (
                <div className="mt-8 p-6 rounded-xl bg-muted/30 border border-border/30 text-left space-y-3">
                  <p className="text-sm font-semibold text-center mb-4">Transaction Details</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Venue</span>
                    <span className="font-medium">{selectedVenue?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="font-medium capitalize">{paymentMethod === 'online' ? '💳 Online' : '💵 Cash'}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-border/30 pt-3">
                    <span className="font-semibold">Total Amount</span>
                    <span className="font-bold text-primary text-lg">₹{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Error Actions */}
              {status === 'error' && (
                <div className="space-y-4 mt-8">
                  <Alert className="border-destructive/50 bg-destructive/10">
                    <AlertCircleIcon className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-sm">
                      If the issue persists, please contact support or try a different payment method.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={handleRetry}
                      size="lg"
                      className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300 font-medium rounded-xl"
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={() => router.push('/')}
                      variant="outline"
                      size="lg"
                      className="border-2 hover:border-primary/30 transition-all duration-300 font-medium rounded-xl"
                    >
                      Back to Home
                    </Button>
                  </div>
                </div>
              )}

              {/* Security Notice */}
              {status === 'processing' && (
                <div className="mt-8 flex items-start gap-3 text-left bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/40">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                    🔒
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <span className="font-semibold">Secure Transaction:</span> Your payment information is encrypted and processed securely. Do not refresh or close this page.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        {status === 'processing' && (
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              This usually takes 5-10 seconds. Thank you for your patience.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
