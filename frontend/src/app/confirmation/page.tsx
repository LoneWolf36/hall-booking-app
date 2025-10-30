'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BookingProgress } from '@/components/booking/ProgressIndicator';
import { useBookingStore } from '@/stores';
import { toast } from 'sonner';
import {
  CheckCircleIcon,
  CalendarDaysIcon,
  UsersIcon,
  CreditCardIcon,
  MapPinIcon,
  EditIcon,
  InfoIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { createBooking } from '@/lib/api/bookings';

export default function ConfirmationPage() {
  const router = useRouter();
  const {
    selectedVenue,
    selectedDate,
    selectedDates,
    startTime,
    endTime,
    eventType,
    guestCount,
    paymentMethod,
    setCurrentStep,
    setBookingIds,
    generateIdempotencyKey,
  } = useBookingStore();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedVenue || !eventType || !paymentMethod) {
      toast.error('Please complete previous steps first');
      router.push('/payment');
    } else {
      setCurrentStep('confirmation');
    }
  }, [selectedVenue, eventType, paymentMethod, setCurrentStep, router]);

  // Calculate pricing - NO DISCOUNT
  const basePrice = selectedVenue?.basePriceCents || 0;
  const subtotal = basePrice / 100;
  const taxes = Math.round(subtotal * 0.18 * 100) / 100;
  const finalAmount = subtotal + taxes;

  const handleConfirm = async () => {
    if (!termsAccepted) {
      toast.error('Please accept terms and conditions');
      return;
    }

    if (!selectedVenue || !selectedDates || selectedDates.length === 0) {
      toast.error('Missing booking details');
      return;
    }

    setIsLoading(true);
    try {
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      const startDate = sortedDates[0];
      const endDate = new Date(sortedDates[sortedDates.length - 1]);
      endDate.setHours(23, 59, 59);

      const idempotencyKey = generateIdempotencyKey();

      const response = await createBooking(
        {
          venueId: selectedVenue.id,
          eventType: eventType || 'other',
          guestCount: guestCount || 0,
          selectedDates: selectedDates.map(d => format(d, 'yyyy-MM-dd')),
          startTs: startDate.toISOString(),
          endTs: endDate.toISOString(),
          idempotencyKey,
        },
        localStorage.getItem('auth_token') || undefined
      );

      if (response.success && response.data) {
        setBookingIds(response.data.id, response.data.bookingNumber);
        toast.success(`Booking #${response.data.bookingNumber} created!`);
        // Navigate to payment processing or success based on payment method
        router.push(paymentMethod === 'online' ? '/payment/processing' : '/success');
      } else {
        toast.error(response.message || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Booking creation error:', error);
      toast.error('Failed to create booking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/payment');
  };

  const handleEdit = (section: string) => {
    switch (section) {
      case 'dates':
        router.push('/booking');
        break;
      case 'details':
        router.push('/event-details');
        break;
      case 'payment':
        router.push('/payment');
        break;
    }
  };

  if (!selectedVenue || !eventType || !selectedDates || selectedDates.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen py-8 px-4 pb-24 lg:pb-8">
      <div className="container max-w-4xl mx-auto space-y-8">
        {/* Progress Indicator */}
        <BookingProgress variant="horizontal" className="mb-8" />

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Review Your Booking</h1>
          <p className="text-muted-foreground">Verify all details before confirming</p>
        </div>

        {/* Booking Summary - Dates */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="h-5 w-5 text-primary" />
                <CardTitle>Event Date & Time</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit('dates')}
                className="gap-2 text-xs"
              >
                <EditIcon className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedDates && selectedDates.length > 0 && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Date Range</p>
                  {selectedDates.length === 1 ? (
                    <p className="font-semibold">{format(selectedDates[0], 'MMMM d, yyyy')}</p>
                  ) : (
                    <>
                      <p className="font-semibold">
                        {format([...selectedDates].sort((a, b) => a.getTime() - b.getTime())[0], 'MMMM d')} - {format([...selectedDates].sort((a, b) => a.getTime() - b.getTime())[selectedDates.length - 1], 'd, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{selectedDates.length} days total</p>
                    </>
                  )}
                </div>
              </>
            )}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Time</p>
              <p className="font-semibold">Full day (00:00 - 23:59)</p>
            </div>
          </CardContent>
        </Card>

        {/* All Selected Dates */}
        {selectedDates && selectedDates.length > 1 && (
          <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">All Selected Dates ({selectedDates.length} days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map((date, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center text-sm font-medium hover:bg-primary/20 transition-colors">
                    {format(date, 'MMM d')}
                    <div className="text-xs text-muted-foreground">{format(date, 'EEE')}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Booking Summary - Venue & Details */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPinIcon className="h-5 w-5 text-primary" />
                <CardTitle>Venue & Event Details</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit('details')}
                className="gap-2 text-xs"
              >
                <EditIcon className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Venue</p>
                <p className="font-semibold text-lg">{selectedVenue.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Event Type</p>
                <p className="font-semibold capitalize">{eventType.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Number of Guests</p>
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-primary" />
                  <p className="font-semibold">{guestCount} guests</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Capacity</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  ✓ Within capacity ({selectedVenue.capacity} max)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-primary" />
                <CardTitle>Payment Details</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit('payment')}
                className="gap-2 text-xs"
              >
                <EditIcon className="h-4 w-4" />
                Edit
              </Button>
            </div>
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
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Amount</span>
                <span className="text-2xl font-bold text-primary">₹{finalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
              <p className="font-semibold text-foreground">Payment Method</p>
              <p className="text-muted-foreground mt-1">
                {paymentMethod === 'online' ? '💳 Online Payment (Razorpay)' : '💵 Cash at Venue'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                I agree to the booking terms and conditions. I understand that this booking is subject to availability
                and venue policies. Cancellations must be made at least 30 days in advance for a full refund.
              </Label>
            </div>

            <Alert className="border-yellow-200 dark:border-yellow-800/40 bg-yellow-50 dark:bg-yellow-900/20">
              <InfoIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                Your booking will be confirmed once payment is completed. You will receive a confirmation email with
                all booking details and event guidelines.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Desktop: Sticky Action Bar */}
        <div className="lg:block hidden sticky bottom-4 z-50">
          <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-lg p-4">
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
                onClick={handleConfirm}
                disabled={!termsAccepted || isLoading}
                isLoading={isLoading}
                size="lg"
                className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg transition-all duration-300 font-medium rounded-xl"
              >
                <CheckCircleIcon className="mr-2 h-5 w-5" />
                Confirm & Pay
              </Button>
            </div>
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
              onClick={handleConfirm}
              disabled={!termsAccepted || isLoading}
              isLoading={isLoading}
              size="lg"
              className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg transition-all duration-300 font-medium rounded-xl"
            >
              <CheckCircleIcon className="mr-2 h-4 w-4" />
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
