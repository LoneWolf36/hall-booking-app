/**
 * Payment Method Selection - Fixed Multi-Date Pricing
 * 
 * Comprehensive fixes:
 * - Proper total calculation from booking store
 * - Multi-date pricing integration
 * - Step guard protection
 * - Back navigation with state preservation
 */

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
import { useBookingStore } from '@/stores';
import { useStepGuard, useBookingNavigation } from '@/hooks/useStepGuard';
import { toast } from 'sonner';
import { CreditCardIcon, InfoIcon, ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import { formatDateRangeCompact } from '@/lib/dates';

type PaymentMethodType = 'online' | 'cash';

export default function PaymentMethodPage() {
  const router = useRouter();
  const { isValid } = useStepGuard('payment_method');
  const { goBack } = useBookingNavigation();
  
  const {
    selectedVenue,
    selectedDates,
    eventType,
    guestCount,
    selectedAddons,
    basePrice,
    addonsTotal,
    taxAmount,
    platformFee,
    totalAmount,
    paymentMethod: storedPaymentMethod,
    setPaymentMethod,
    calculateTotals,
  } = useBookingStore();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>(
    (storedPaymentMethod as PaymentMethodType) || 'online'
  );
  const [isLoading, setIsLoading] = useState(false);

  // Recalculate totals on mount to ensure correct pricing
  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const handleMethodChange = (method: PaymentMethodType) => {
    setSelectedMethod(method);
    
    // Update payment method in store immediately for pricing recalculation
    const profile = method === 'online' ? 'full_online' : 'cash_only';
    setPaymentMethod(method, profile);
  };

  const handleContinue = async () => {
    setIsLoading(true);
    
    try {
      // Final validation
      if (!selectedVenue || selectedDates.length === 0) {
        toast.error('Missing booking details. Please start over.');
        router.push('/booking');
        return;
      }
      
      const profile = selectedMethod === 'online' ? 'full_online' : 'cash_only';
      setPaymentMethod(selectedMethod, profile);
      
      toast.success(`Payment method selected: ${selectedMethod === 'online' ? 'Online Payment' : 'Cash at Venue'}`);
      router.push('/auth');
    } catch (error) {
      console.error('Payment method error:', error);
      toast.error('Failed to save payment method');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    goBack();
  };

  if (!isValid) return null;

  // Calculate display values
  const daysCount = selectedDates.length || 1;
  const venueSubtotal = (basePrice * daysCount);
  const finalVenueSubtotal = venueSubtotal + addonsTotal;
  const finalTaxAmount = finalVenueSubtotal * 0.18;
  const finalPlatformFee = selectedMethod === 'online' ? finalVenueSubtotal * 0.12 : finalVenueSubtotal * 0.05;
  const calculatedTotal = finalVenueSubtotal + finalTaxAmount + finalPlatformFee;

  return (
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4 pb-24 lg:pb-8 overflow-x-hidden bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Progress Indicator */}
        <BookingProgress variant="horizontal" className="mb-8" />

        {/* Header with Booking Summary */}
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Payment Method</h1>
            <p className="text-lg text-muted-foreground">Choose how you'd like to pay for your booking</p>
          </div>
          
          {/* Quick Summary */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {formatDateRangeCompact(selectedDates)} • {guestCount} guests
                  </span>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  {daysCount} day{daysCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Breakdown Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Price Breakdown</CardTitle>
            <CardDescription>Detailed cost breakdown for your booking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {/* Venue Cost */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  Venue ({daysCount} day{daysCount !== 1 ? 's' : ''} × ₹{basePrice.toLocaleString()})
                </span>
                <span className="font-medium">₹{venueSubtotal.toLocaleString()}</span>
              </div>
              
              {/* Add-ons */}
              {selectedAddons.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    Add-ons ({selectedAddons.length} item{selectedAddons.length !== 1 ? 's' : ''})
                  </span>
                  <span className="font-medium">₹{addonsTotal.toLocaleString()}</span>
                </div>
              )}
              
              {/* Subtotal */}
              <div className="flex justify-between items-center text-sm pt-2 border-t">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₹{finalVenueSubtotal.toLocaleString()}</span>
              </div>
              
              {/* Taxes */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">GST (18%)</span>
                <span className="font-medium">₹{finalTaxAmount.toLocaleString()}</span>
              </div>
              
              {/* Platform Fee */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  Platform Fee ({selectedMethod === 'online' ? '12%' : '5%'})
                </span>
                <span className="font-medium">₹{finalPlatformFee.toLocaleString()}</span>
              </div>
              
              {/* Total */}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">₹{calculatedTotal.toLocaleString()}</span>
                </div>
              </div>
              
              {selectedMethod === 'cash' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg p-3 mt-4">
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                    💰 Save ₹{Math.round(finalVenueSubtotal * 0.07).toLocaleString()} with cash payment!
                  </p>
                </div>
              )}
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

          <CardContent className="space-y-6">
            <RadioGroup value={selectedMethod} onValueChange={handleMethodChange}>
              {/* Online Payment Option */}
              <div className="space-y-3">
                <div
                  onClick={() => handleMethodChange('online')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    selectedMethod === 'online'
                      ? 'border-primary bg-primary/5 shadow-md'
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
                  onClick={() => handleMethodChange('cash')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    selectedMethod === 'cash'
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border/50 bg-card/30 hover:border-primary/30 hover:bg-primary/2.5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="cash" id="cash" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="cash" className="text-base font-semibold cursor-pointer">
                        Pay at Venue
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Pay in cash on the day of your event
                      </p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs font-medium bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/40">
                          Lower Platform Fee
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary border-primary/20">
                          Flexible Payment
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {/* Method-Specific Info */}
            <Alert className="border-primary/30 bg-primary/5">
              <InfoIcon className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                {selectedMethod === 'online'
                  ? 'You will be redirected to a secure payment gateway. Your booking will be confirmed immediately upon successful payment.'
                  : 'A confirmation will be sent to your email. Pay the total amount in cash when you arrive at the venue.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Desktop Navigation */}
        <div className="lg:block hidden sticky bottom-4 z-50">
          <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between">
              <Button
                onClick={handleBack}
                variant="outline"
                size="lg"
                className="flex items-center gap-2 h-12 px-6 border-2 hover:border-primary/30"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Add-ons
              </Button>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Step 5 of 8</p>
                <p className="text-xs text-muted-foreground">Payment Method</p>
              </div>
              
              <Button
                onClick={handleContinue}
                disabled={isLoading}
                size="lg"
                className="flex items-center gap-2 h-12 px-6 bg-gradient-to-r from-primary to-primary/90"
              >
                {isLoading ? 'Saving...' : 'Continue to Login'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-xl border-t border-border/60 z-50 shadow-2xl">
          <div className="flex gap-3">
            <Button
              onClick={handleBack}
              variant="outline"
              size="lg"
              className="flex-1 h-12 border-2 hover:border-primary/30 font-medium rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleContinue}
              disabled={isLoading}
              size="lg"
              className="flex-2 h-12 bg-gradient-to-r from-primary to-primary/90 font-medium rounded-xl"
            >
              {isLoading ? 'Saving...' : 'Login'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}