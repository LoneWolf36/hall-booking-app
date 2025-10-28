/**
 * Event Details Page
 * 
 * Step 2 of booking flow: Collect event type, guest count, and special requests.
 * Integrates with booking store for state management.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookingProgress } from '@/components/booking/ProgressIndicator';
import { StepNavigation } from '@/components/booking/StepNavigation';
import { EventTypeSelector } from '@/components/booking/EventTypeSelector';
import { GuestCountSelector } from '@/components/booking/GuestCountSelector';
import { useBookingStore, type EventType } from '@/stores';
import { toast } from 'sonner';
import { CalendarDaysIcon, UsersIcon, InfoIcon } from 'lucide-react';
import { format } from 'date-fns';

export default function EventDetailsPage() {
  const router = useRouter();
  
  const {
    selectedVenue,
    selectedDate,
    startTime,
    endTime,
    eventType: storedEventType,
    guestCount: storedGuestCount,
    specialRequests: storedSpecialRequests,
    setEventDetails,
    setCurrentStep,
  } = useBookingStore();

  const [eventType, setEventType] = useState<EventType | null>(storedEventType);
  const [guestCount, setGuestCount] = useState(storedGuestCount || 0);
  const [specialRequests, setSpecialRequests] = useState(storedSpecialRequests || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if venue not selected
  useEffect(() => {
    if (!selectedVenue || !selectedDate) {
      toast.error('Please select a venue first');
      router.push('/availability');
    } else {
      setCurrentStep('event_details');
    }
  }, [selectedVenue, selectedDate, setCurrentStep, router]);

  /**
   * Validate form data
   */
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!eventType) {
      newErrors.eventType = 'Please select an event type';
    }

    if (guestCount < 1) {
      newErrors.guestCount = 'Please enter number of guests';
    }

    if (selectedVenue && guestCount > selectedVenue.capacity!) {
      newErrors.guestCount = `Maximum capacity is ${selectedVenue.capacity} guests`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleContinue = () => {
    if (!validate()) {
      toast.error('Please fix the errors before continuing');
      return;
    }

    if (!eventType) return;

    // Save to store
    setEventDetails(eventType, guestCount, specialRequests);
    
    toast.success('Event details saved');
    
    // Navigate to next step (skip add-ons for MVP, go to payment)
    router.push('/payment');
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    router.push('/availability');
  };

  if (!selectedVenue || !selectedDate) {
    return null;
  }

  // Calculate duration in hours
  const duration = (() => {  
    if (!startTime || !endTime) return null;
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const durationMinutes = endMinutes - startMinutes;
    return (durationMinutes / 60).toFixed(1);
  })();

  return (
    <div className="min-h-screen py-8 px-4 pb-24 lg:pb-8">
      <div className="container max-w-4xl mx-auto space-y-8">
        {/* Progress Indicator */}
        <BookingProgress variant="horizontal" className="mb-8" />

        {/* Booking Summary Card */}
        <Card className="bg-card/40 backdrop-blur-xl border-border/40 shadow-xl">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Venue</p>
                <p className="font-medium">{selectedVenue.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Date & Time</p>
                <p className="font-medium">
                  {format(selectedDate, 'MMM dd, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {startTime} - {endTime}
                  {duration && ` (${duration}h)`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Capacity</p>
                <p className="font-medium">Up to {selectedVenue.capacity} guests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Form Card */}
        <Card className="bg-card/60 backdrop-blur-2xl border-border/40 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5" />
              Event Details
            </CardTitle>
            <CardDescription>
              Tell us about your event so we can better prepare
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Event Type Selection */}
            <div className="space-y-3">
              <Label className="text-base">
                Event Type <span className="text-destructive">*</span>
              </Label>
              <EventTypeSelector
                value={eventType}
                onChange={setEventType}
                error={errors.eventType}
              />
            </div>

            {/* Guest Count */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="guest-count" className="text-base">
                  Number of Guests <span className="text-destructive">*</span>
                </Label>
                <span className="text-sm text-muted-foreground">
                  <UsersIcon className="inline h-4 w-4 mr-1" />
                  Max: {selectedVenue.capacity}
                </span>
              </div>
              <GuestCountSelector
                value={guestCount}
                onChange={setGuestCount}
                min={1}
                max={selectedVenue.capacity || 1000}
                error={errors.guestCount}
              />
            </div>

            {/* Special Requests */}
            <div className="space-y-3">
              <Label htmlFor="special-requests" className="text-base">
                Special Requests (Optional)
              </Label>
              <Textarea
                id="special-requests"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Any specific requirements or questions? E.g., dietary restrictions, accessibility needs, equipment requests..."
                rows={4}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {specialRequests.length}/500 characters
              </p>
            </div>

            {/* Info Alert */}
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Your event details help us ensure the venue is perfectly suited for your needs.
                You can modify these details later if needed.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Navigation */}
        {/* Desktop: Sticky Action Bar */}
        <div className="lg:block hidden sticky bottom-4 z-50">
          <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-lg p-4">
            <StepNavigation
              onNext={handleContinue}
              onBack={handleBack}
              nextLabel="Continue to Payment"
              nextDisabled={!eventType || guestCount < 1}
            />
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
              disabled={!eventType || guestCount < 1}
              size="lg"
              className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg transition-all duration-300 font-medium rounded-xl"
            >
              Continue to Payment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
