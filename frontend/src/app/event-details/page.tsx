/**
 * Event Details Page - Complete Multi-Date Implementation
 *
 * Step 2 with:
 * - Multi-date display with inline editing
 * - Back navigation that preserves state
 * - Route protection with step guard
 * - Proper form validation and error handling
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BookingProgress } from '@/components/booking/ProgressIndicator';
import { EventTypeSelector } from '@/components/booking/EventTypeSelector';
import { GuestCountSelector } from '@/components/booking/GuestCountSelector';
import { useBookingStore, type EventType } from '@/stores';
import { useStepGuard, useBookingNavigation } from '@/hooks/useStepGuard';
import { toast } from 'sonner';
import { CalendarDays, Users, Info, X, ArrowLeft, ArrowRight, Edit3 } from 'lucide-react';
import { format } from 'date-fns';
import { formatDateRangeCompact } from '@/lib/dates';
import { motion, AnimatePresence } from 'framer-motion';

export default function EventDetailsPage() {
  const router = useRouter();
  const { isValid } = useStepGuard('event_details');
  const { goBack } = useBookingNavigation();

  const {
    selectedVenue,
    selectedDates,
    startTime,
    endTime,
    eventType: storedEventType,
    guestCount: storedGuestCount,
    specialRequests: storedSpecialRequests,
    removeSelectedDate,
    setEventDetails,
    calculateTotals,
  } = useBookingStore();

  const [eventType, setEventType] = useState<EventType | null>(storedEventType ?? null);
  const [guestCount, setGuestCount] = useState<number>(storedGuestCount || 50);
  const [specialRequests, setSpecialRequests] = useState<string>(storedSpecialRequests || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Recalculate totals when dates change
  useEffect(() => {
    calculateTotals();
  }, [selectedDates, calculateTotals]);

  // Date display logic
  const getDateRangeDisplay = useCallback(() => {
    if (!selectedDates || selectedDates.length === 0) return 'No dates selected';
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    return formatDateRangeCompact(sorted);
  }, [selectedDates]);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!eventType) newErrors.eventType = 'Please select an event type';
    if (guestCount < 1) newErrors.guestCount = 'Please enter number of guests';
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

  const handleRemoveDate = (dateToRemove: Date) => {
    removeSelectedDate(dateToRemove);
    toast.success(`Removed ${format(dateToRemove, 'MMM d')} from selection`);
    
    // If no dates left, redirect back to booking
    if (selectedDates.length <= 1) {
      toast.info('Please select dates for your event');
      setTimeout(() => router.push('/booking'), 1000);
    }
  };

  const handleEditDates = () => {
    toast.info('Returning to calendar to edit dates');
    router.push('/booking');
  };

  const handleContinue = () => {
    if (selectedDates.length === 0) {
      toast.error('Please select at least one date');
      router.push('/booking');
      return;
    }
    
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
    // Save current state before going back
    if (eventType) {
      setEventDetails(eventType, guestCount, specialRequests);
    }
    goBack();
  };

  if (!isValid) return null; // useStepGuard handles redirect

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
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4 pb-24 lg:pb-8 overflow-x-hidden bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-4xl mx-auto space-y-6 sm:space-y-8 w-full">
        {/* Progress Indicator */}
        <BookingProgress variant="horizontal" className="mb-8" />

        {/* Enhanced Selection Summary with Multi-Date Display */}
        <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Selected Dates & Venue
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditDates}
                className="text-primary hover:text-primary/80 text-sm"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Edit Dates
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Venue and Time Info */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-muted-foreground mb-1 text-xs font-medium">Venue</p>
                <p className="font-semibold text-foreground">{selectedVenue?.name}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-muted-foreground mb-1 text-xs font-medium">Time per day</p>
                <p className="font-semibold text-foreground">
                  {startTime} - {endTime}
                  {duration && ` (${duration}h)`}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-muted-foreground mb-1 text-xs font-medium">Capacity</p>
                <p className="font-semibold text-foreground">
                  Up to {selectedVenue?.capacity ?? '—'} guests
                </p>
              </div>
            </div>

            {/* Multi-Date Display */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Selected Dates</span>
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              {/* Compact Range Display */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                <p className="text-sm font-semibold text-primary">
                  {getDateRangeDisplay()}
                </p>
              </div>
              
              {/* Individual Dates with Remove Option */}
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground mb-1">Individual dates:</p>
                <AnimatePresence>
                  {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map((date, idx) => (
                    <motion.div
                      key={format(date, 'yyyy-MM-dd')}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        <span className="text-sm font-medium">{format(date, "MMM d, yyyy")}</span>
                        <span className="text-xs text-muted-foreground">({format(date, "EEE")})</span>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveDate(date)}
                        className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Form Card */}
        <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
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
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your event details help us ensure the venue is perfectly suited for your needs.
                You can modify these details later if needed.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Navigation - Desktop */}
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
                Back to Calendar
              </Button>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Step 2 of 8</p>
                <p className="text-xs text-muted-foreground">Event Details</p>
              </div>
              
              <Button
                onClick={handleContinue}
                disabled={!eventType || guestCount < 1 || selectedDates.length === 0}
                size="lg"
                className="flex items-center gap-2 h-12 px-6 bg-gradient-to-r from-primary to-primary/90"
              >
                Continue to Add-ons
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation - Mobile */}
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
              disabled={!eventType || guestCount < 1 || selectedDates.length === 0}
              size="lg"
              className="flex-2 h-12 bg-gradient-to-r from-primary to-primary/90 font-medium rounded-xl"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}