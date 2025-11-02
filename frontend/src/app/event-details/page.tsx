/**
 * Event Details Page
 *
 * Step 2 of booking flow: Collect event type, guest count, and special requests.
 * Integrates with booking store for state management.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { CalendarDays, Users, Info } from 'lucide-react';
import { format } from 'date-fns';

export default function EventDetailsPage() {
  const router = useRouter();

  const {
    selectedVenue,
    selectedDate,
    selectedDates,
    startTime,
    endTime,
    eventType: storedEventType,
    guestCount: storedGuestCount,
    specialRequests: storedSpecialRequests,
    setEventDetails,
    setCurrentStep,
  } = useBookingStore();

  const [eventType, setEventType] = useState<EventType | null>(storedEventType ?? null);
  const [guestCount, setGuestCount] = useState<number>(storedGuestCount || 0);
  const [specialRequests, setSpecialRequests] = useState<string>(storedSpecialRequests || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recalculatingPrice] = useState(false);

  // Keep step index in sync (optional, prevents unused var)
  useEffect(() => {
    setCurrentStep?.('event_details');
  }, [setCurrentStep]);

  // Redirect if venue/date not selected
  useEffect(() => {
    if (!selectedVenue || !selectedDate) {
      router.push('/booking');
    }
  }, [selectedVenue, selectedDate, router]);

  // Calculate date range display intelligently - FIXED BUG
  const getDateRangeDisplay = useCallback(() => {
    if (!selectedDates || selectedDates.length === 0) {
      return selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'No date selected';
    }

    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    // 🔧 FIXED: Use first element, not entire array
    const firstDate = sorted[0];
    const lastDate = sorted[sorted.length - 1];

    if (sorted.length === 1) {
      return format(firstDate, 'MMM dd, yyyy');
    }

    const isConsecutive = sorted.every((date, index) => {
      if (index === 0) return true;
      const prevDate = sorted[index - 1];
      const dayDiff = (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      return dayDiff === 1;
    });

    if (isConsecutive) {
      return `${format(firstDate, 'MMM dd')} - ${format(lastDate, 'dd, yyyy')} (${sorted.length} days)`;
    }
    return `${format(firstDate, 'MMM dd')} - ${format(lastDate, 'dd, yyyy')} (${sorted.length} days, non-consecutive)`;
  }, [selectedDate, selectedDates]);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!eventType) {
      newErrors.eventType = 'Please select an event type';
    }

    if (guestCount < 1) {
      newErrors.guestCount = 'Please enter number of guests';
    }

    if (selectedVenue && selectedVenue.capacity && guestCount > selectedVenue.capacity) {
      newErrors.guestCount = `Maximum capacity is ${selectedVenue.capacity} guests`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [eventType, guestCount, selectedVenue]);

  // Handlers
  const handleEventTypeChange = (val: EventType) => {
    setEventType(val);
    setErrors(prev => ({ ...prev, eventType: '' }));
  };

  const handleGuestCountChange = (val: number) => {
    setGuestCount(val);
    setErrors(prev => ({ ...prev, guestCount: '' }));
  };

  const handleContinue = () => {
    if (!validate()) {
      toast.error('Please fix the errors before continuing');
      return;
    }
    if (!eventType) return;
    setEventDetails(eventType, guestCount, specialRequests);
    toast.success('Event details saved');
    router.push('/addons');
  };

  const handleBack = () => {
    router.push('/booking');
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
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4 pb-24 lg:pb-8 overflow-x-hidden">
      <div className="container max-w-4xl mx-auto space-y-6 sm:space-y-8 w-full">
        {/* Progress Indicator */}
        <BookingProgress variant="horizontal" className="mb-8" />

        {/* Selection Summary */}
        <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-xl">
          <CardContent className="grid gap-4 md:grid-cols-3 py-6">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Selected Dates</p>
              <p className="font-semibold text-foreground">
                {getDateRangeDisplay()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Time</p>
              <p className="font-semibold text-foreground">
                {startTime} - {endTime}
                {duration && ` (${duration}h/day)`}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Capacity</p>
              <p className="font-semibold text-foreground">
                Up to {selectedVenue?.capacity ?? '—'} guests
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Date Details - Show all selected dates */}
        {selectedDates && selectedDates.length > 1 && (
          <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">Selected Dates ({selectedDates.length} days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map((date, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center text-sm font-medium">
                    {format(date, 'MMM d')}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Form Card */}
        <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-2xl hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
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
                onChange={handleEventTypeChange}
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
                  <Users className="inline h-4 w-4 mr-1" />
                  Max: {selectedVenue?.capacity ?? '—'}
                </span>
              </div>
              <GuestCountSelector
                value={guestCount}
                onChange={handleGuestCountChange}
                min={1}
                max={selectedVenue?.capacity ?? 1000}
                error={errors.guestCount}
              />
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="special-requests" className="text-base">
                  Special Requests (Optional)
                </Label>
                {recalculatingPrice && (
                  <span className="text-xs text-muted-foreground">Updating pricing...</span>
                )}
              </div>
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
              <Info className="h-4 w-4" />
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
              nextLabel="Continue to Add-ons"
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
              Continue to Add-ons
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}