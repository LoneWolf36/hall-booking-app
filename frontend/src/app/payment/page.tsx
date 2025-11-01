'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BookingProgress } from '@/components/booking/ProgressIndicator';
import { StepNavigation } from '@/components/booking/StepNavigation';
import { useBookingStore } from '@/stores';
import { toast } from 'sonner';
import { CreditCardIcon, WalletIcon, InfoIcon } from 'lucide-react';
import { format } from 'date-fns';

type PaymentMethod = 'online' | 'cash';
type PaymentProfile = 'hybrid' | 'cash_only';

const getPaymentProfile = (method: PaymentMethod): PaymentProfile => {
  return method === 'online' ? 'hybrid' : 'cash_only';
};

export default function PaymentPage() {
  const router = useRouter();
  const {
    selectedVenue,
    selectedDate,
    eventType,
    guestCount,
    paymentMethod: storedPaymentMethod,
    setPaymentMethod: setStorePaymentMethod,
    setCurrentStep,
  } = useBookingStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    (storedPaymentMethod as PaymentMethod) || 'online'
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedVenue || !eventType) {
      toast.error('Please complete previous steps first');
      router.push('/event-details');
    } else {
      setCurrentStep('payment_method');
    }
  }, [selectedVenue, eventType, setCurrentStep, router]);

  // Calculate pricing - NO DISCOUNT
  const basePrice = selectedVenue?.basePriceCents || 0;
  const subtotal = basePrice / 100;
  const taxes = Math.round(subtotal * 0.18 * 100) / 100; // 18% GST
  const finalAmount = subtotal + taxes;

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      // Save payment method to store
      const paymentProfile = getPaymentProfile(paymentMethod);
      setStorePaymentMethod(paymentMethod, paymentProfile);

      toast.success(`Payment method: ${paymentMethod === 'online' ? 'Online' : 'Cash'}`);

      // Navigate to confirmation
      router.push('/confirmation');
    } catch (error) {
      toast.error('Failed to save payment method');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/event-details');
  };

  if (!selectedVenue || !eventType) {
    return null;
  }

  return (
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4 pb-24 lg:pb-8 overflow-x-hidden">
      <div className="container max-w-4xl mx-auto space-y-8">
        {/* Progress Indicator */}
        <BookingProgress variant="horizontal" className="mb-8" />

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Payment Method</h1>
          <p className="text-muted-foreground">Choose how you'd like to pay for your booking</p>
        </div>

        {/* Price Breakdown */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Price Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Venue Booking</span>
                <span className="font-medium">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">GST (18%)</span>
                <span className="font-medium">₹{taxes.toLocaleString()}</span>
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Amount</span>
                  <span className="text-lg font-bold">₹{finalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-3">
                  <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">Pay at Venue</p>
                    <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                      Pay in cash when you arrive at the venue on the day of your event.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">Total Amount</span>
                <span className="text-2xl font-bold text-primary">₹{finalAmount.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Selection */}
        <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5" />
              Select Payment Method
            </CardTitle>
            <CardDescription>Choose your preferred way to pay</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              {/* Online Payment Option */}
              <div className="space-y-3">
                <div
                  onClick={() => setPaymentMethod('online')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    paymentMethod === 'online'
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 bg-card/30 hover:border-primary/30 hover:bg-primary/2.5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="online" id="online" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="online" className="text-base font-semibold cursor-pointer">
                        Pay Online
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Secure payment via Razorpay • Credit/Debit Card, UPI, Wallet
                      </p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary border-primary/20">
                          Instant Confirmation
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary border-primary/20">
                          Secure Gateway
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Payment Option */}
              <div className="space-y-3">
                <div
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    paymentMethod === 'cash'
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 bg-card/30 hover:border-primary/30 hover:bg-primary/2.5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="cash" id="cash" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="cash" className="text-base font-semibold cursor-pointer flex items-center gap-2">
                        Pay at Venue
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">Pay in cash on the day of your event</p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary border-primary/20">
                          Flexible Payment
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {/* Info Alert */}
            <Alert className="border-primary/30 bg-primary/5">
              <InfoIcon className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                {paymentMethod === 'online'
                  ? 'You will be redirected to a secure payment gateway. Your booking will be confirmed immediately upon successful payment.'
                  : 'A confirmation will be sent to your email. You can pay the remaining amount in cash at the venue on the day of your event.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Desktop: Sticky Action Bar */}
        <div className="lg:block hidden sticky bottom-4 z-50">
          <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-lg p-4">
            <StepNavigation onNext={handleContinue} onBack={handleBack} nextLabel="Continue to Review" isNextLoading={isLoading} />
          </div>
        </div>

        {/* Mobile: Sticky Floating Action Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-xl border-t border-border/60 z-50 shadow-2xl">
          <div className="flex gap-3">
            <Button
              onClick={handleBack}
              variant="outline"
              size="lg"
              className="flex-1 h-12 border-2 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 font-medium rounded-xl"
            >
              Back
            </Button>
            <Button
              onClick={handleContinue}
              isLoading={isLoading}
              size="lg"
              className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg transition-all duration-300 font-medium rounded-xl"
            >
              Review Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
