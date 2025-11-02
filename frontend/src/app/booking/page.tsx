/**
 * Booking Page - Enhanced with Time Slots and Quick Shortcuts
 * 
 * Complete implementation with:
 * - Multi-date selection with persistence
 * - Quick date shortcuts (Today, Tomorrow, Weekend)
 * - Time slot selection (Morning, Afternoon, Evening, Full Day)
 * - Proper navigation and back support
 * - State rehydration and error recovery
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { QuickDateShortcuts } from "@/components/booking/QuickDateShortcuts";
import { TimeSlotSelector, getDefaultTimeSlot, type TimeSlot } from "@/components/booking/TimeSlotSelector";
import { CalendarIcon, ArrowRightIcon, InfoIcon, CheckCircle2Icon, LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import { useBookingStore } from "@/stores";
import { useStepGuard } from "@/hooks/useStepGuard";
import { useRouter } from "next/navigation";
import { formatDateRangeCompact } from "@/lib/dates";
import { calculatePricing, listVenues } from "@/lib/api/venues";
import { getVenueAvailability } from "@/lib/api/bookings";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";

const normalizeDates = (arr?: any[]) => (arr ?? []).map((d) => (d instanceof Date ? d : new Date(d)));

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function BookingPage() {
  const router = useRouter();
  const { isValid } = useStepGuard('venue_selection');
  
  const {
    selectedVenue,
    selectedDates: storedDates,
    startTime: storedStartTime,
    endTime: storedEndTime,
    setSelectedDates,
    setVenueDetails,
    setCurrentStep,
  } = useBookingStore();
  
  const hasFetchedVenues = useRef(false);
  const hasFetchedAvailability = useRef(false);

  // Local state  
  const [selectedDates, setSelectedDates_Local] = useState<Date[]>(normalizeDates(storedDates));
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>(() => {
    // Try to restore from stored start/end time
    if (storedStartTime && storedEndTime) {
      const stored = TIME_SLOTS.find(slot => 
        slot.startTime === storedStartTime && slot.endTime === storedEndTime
      );
      if (stored) return stored;
    }
    return getDefaultTimeSlot();
  });
  
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [pricing, setPricing] = useState<any>(null);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [venues, setVenues] = useState<any[]>([]);
  const [currentVenue, setCurrentVenue] = useState<any>(selectedVenue);
  const [isLoadingVenues, setIsLoadingVenues] = useState(true);

  const debouncedSelectedDates = useDebounce(selectedDates, 300);
  const debouncedTimeSlot = useDebounce(selectedTimeSlot, 300);
  const isVenueLoaded = !!currentVenue;
  const venueInfo = currentVenue;
  
  const isUnavailable = useCallback((date: Date) => {
    return unavailableDates.some(unavailable => 
      format(unavailable, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  }, [unavailableDates]);

  // Load venues on mount
  useEffect(() => {
    if (hasFetchedVenues.current) return;
    hasFetchedVenues.current = true;

    const fetchVenues = async () => {
      try {
        setIsLoadingVenues(true);
        const response = await listVenues();
        
        if (response.success && response.data && response.data.length > 0) {
          setVenues(response.data);
          const venue = selectedVenue || response.data[0];
          setCurrentVenue(venue);
          console.log('Venues loaded successfully:', response.data.length);
        } else {
          toast.error(response.message || 'No venues available');
        }
      } catch (err) {
        console.error('Failed to fetch venues:', err);
        toast.error('Failed to load venues. Please check your connection.');
      } finally {
        setIsLoadingVenues(false);
      }
    };

    fetchVenues();
    
    // Restore persisted dates
    const normalized = normalizeDates(storedDates);
    if (normalized.length > 0) {
      setSelectedDates_Local(normalized);
      console.log('Restored selected dates:', normalized.length);
    }
  }, [selectedVenue, storedDates]);

  // Load availability when venue is ready
  useEffect(() => {
    if (isVenueLoaded && currentVenue?.id && !hasFetchedAvailability.current) {
      hasFetchedAvailability.current = true;
      void fetchVenueAvailability();
    }
  }, [isVenueLoaded, currentVenue?.id]);

  // Calculate pricing when dates or time slot change (debounced)
  useEffect(() => {
    if (debouncedSelectedDates.length > 0 && isVenueLoaded && currentVenue?.id) {
      void calculatePricingForDates(debouncedSelectedDates, debouncedTimeSlot);
    }
  }, [debouncedSelectedDates, debouncedTimeSlot, isVenueLoaded, currentVenue?.id]);

  const fetchVenueAvailability = async () => {
    if (!currentVenue?.id) return;
    
    try {
      setIsLoadingAvailability(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await getVenueAvailability(currentVenue.id, today, 90);
      
      if (response.success && response.data) {
        const bookedDates = response.data
          .filter(day => !day.isAvailable)
          .map(day => new Date(day.date));
        
        setUnavailableDates(bookedDates);
        console.log('Availability loaded:', { total: response.data.length, unavailable: bookedDates.length });
      } else {
        setUnavailableDates([]);
      }
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      setUnavailableDates([]);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const calculatePricingForDates = async (dates: Date[], timeSlot: TimeSlot) => {
    if (dates.length === 0 || !isVenueLoaded || !venueInfo?.id) return;
    
    try {
      setIsLoadingPricing(true);
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      
      // Calculate with time slot multiplier
      const basePricePerDay = (venueInfo.basePriceCents || 0) / 100;
      const adjustedPricePerDay = Math.round(basePricePerDay * timeSlot.priceMultiplier);
      
      const response = await calculatePricing({
        venueId: venueInfo.id,
        selectedDates: sortedDates.map(d => format(d, 'yyyy-MM-dd')),
        timeSlot: timeSlot.id,
        duration: timeSlot.duration,
      });

      if (response.success && response.data) {
        setPricing({ 
          ...response.data,
          timeSlot: timeSlot.id,
          adjustedPricePerDay,
        });
      } else {
        // Fallback pricing with time slot adjustment
        setPricing({
          venueId: venueInfo!.id,
          totalPrice: adjustedPricePerDay * dates.length,
          averagePricePerDay: adjustedPricePerDay,
          timeSlot: timeSlot.id,
          adjustedPricePerDay,
        });
      }
    } catch (error) {
      console.error('Pricing calculation error:', error);
      const basePricePerDay = (venueInfo?.basePriceCents || 0) / 100;
      const adjustedPricePerDay = Math.round(basePricePerDay * timeSlot.priceMultiplier);
      setPricing({
        venueId: venueInfo!.id,
        totalPrice: adjustedPricePerDay * dates.length,
        averagePricePerDay: adjustedPricePerDay,
        timeSlot: timeSlot.id,
        adjustedPricePerDay,
      });
    } finally {
      setIsLoadingPricing(false);
    }
  };

  // Handle date selection with store sync
  const handleDateSelect = useCallback(async (dates: Date[]) => {
    setSelectedDates_Local(dates);
    setSelectedDates(dates); // Update store immediately
    
    if (dates.length > 0) {
      toast.success(`${dates.length} day${dates.length !== 1 ? 's' : ''} selected`, { duration: 2000 });
    } else {
      toast.info('All dates cleared');
    }
  }, [setSelectedDates]);

  // Handle time slot change
  const handleTimeSlotChange = useCallback((timeSlot: TimeSlot) => {
    setSelectedTimeSlot(timeSlot);
    toast.success(`Time slot: ${timeSlot.label} (${timeSlot.startTime}-${timeSlot.endTime})`);
  }, []);

  // Handle continue to next step
  const handleContinue = useCallback(() => {
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date for your event");
      return;
    }
    
    if (!venueInfo) {
      toast.error("Please wait for venue information to load");
      return;
    }
    
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    
    // Update store with complete venue details, multiple dates, and time slot
    setVenueDetails(venueInfo, sorted, selectedTimeSlot.startTime, selectedTimeSlot.endTime);
    
    toast.success(
      `Proceeding with ${sorted.length} day${sorted.length !== 1 ? 's' : ''} • ${selectedTimeSlot.label}`
    );
    router.push("/event-details");
  }, [selectedDates, selectedTimeSlot, venueInfo, setVenueDetails, router]);

  const basePrice = venueInfo?.basePriceCents ? venueInfo.basePriceCents / 100 : 0;
  const adjustedPrice = Math.round(basePrice * selectedTimeSlot.priceMultiplier);
  const totalPrice = selectedDates.length * adjustedPrice;
  
  // Loading states
  if (isLoadingVenues) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoaderIcon className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Loading Venues</h2>
            <p className="text-sm text-muted-foreground">Connecting to booking system...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoadingVenues && venues.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-destructive">No Venues Available</h2>
            <p className="text-sm text-muted-foreground">Please check if the backend server is running.</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return null; // useStepGuard will handle redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Select Your Event Dates & Time</h1>
            <p className="text-lg text-muted-foreground">Choose dates and duration for your event</p>
            {venueInfo && (
              <Badge variant="secondary" className="text-sm px-4 py-1">
                Booking for: {venueInfo.name}
              </Badge>
            )}
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: Calendar and Shortcuts */}
            <div className="lg:col-span-3 space-y-6">
              {/* Quick Shortcuts */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-2 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <QuickDateShortcuts
                      onDateSelect={handleDateSelect}
                      selectedDates={selectedDates}
                      unavailableDates={unavailableDates}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Calendar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card className="border-2 shadow-xl bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle className="text-xl">Event Calendar</CardTitle>
                          <CardDescription>
                            {isLoadingAvailability ? 'Loading availability...' : 'Select multiple dates by clicking'}
                          </CardDescription>
                        </div>
                      </div>
                      
                      {selectedDates.length > 0 && (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <BookingCalendar
                      selectedDates={selectedDates}
                      onDateSelect={handleDateSelect}
                      unavailableDates={unavailableDates}
                      isLoading={isLoadingAvailability}
                      className="border-0 shadow-none bg-transparent"
                    />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Time Slot Selection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <Card className="border-2 shadow-xl bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">Event Duration</CardTitle>
                    <CardDescription>
                      Choose the time slot that fits your event
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    <TimeSlotSelector
                      value={selectedTimeSlot.id}
                      onChange={handleTimeSlotChange}
                      basePrice={basePrice}
                      disabled={isLoadingVenues}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Booking Tips */}
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <InfoIcon className="h-5 w-5" />
                    Booking Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>• Select consecutive dates for multi-day events to get better rates</p>
                  <p>• Morning and afternoon slots offer significant savings</p>
                  <p>• Full day bookings include 24-hour access with setup time</p>
                  <p>• You can edit your selection in later steps</p>
                </CardContent>
              </Card>
            </div>

            {/* Right: Summary */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-2 shadow-xl bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-sm sticky top-20">
                <CardHeader>
                  <CardTitle className="text-xl">Booking Summary</CardTitle>
                  <CardDescription>
                    {isVenueLoaded && venueInfo?.name ? venueInfo.name : 'Loading venue...'}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Time Slot Summary */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Selected Time</span>
                      <Badge variant="outline" className="text-xs">
                        {selectedTimeSlot.duration}h duration
                      </Badge>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2">
                        <selectedTimeSlot.icon className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-semibold text-primary">{selectedTimeSlot.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}
                          </p>
                        </div>
                      </div>
                      {selectedTimeSlot.priceMultiplier < 1 && (
                        <Badge className="bg-green-100 text-green-700 text-[10px] mt-2">
                          {Math.round((1 - selectedTimeSlot.priceMultiplier) * 100)}% savings
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <Separator />

                  {/* Selected Dates Display */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Selected Dates</span>
                      <Badge variant="secondary">
                        {selectedDates.length} {selectedDates.length === 1 ? "day" : "days"}
                      </Badge>
                    </div>

                    {selectedDates.length > 0 ? (
                      <div className="space-y-3">
                        {/* Intelligent Range Display */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm font-medium text-primary">
                            {formatDateRangeCompact([...selectedDates].sort((a, b) => a.getTime() - b.getTime()))}
                          </p>
                        </div>
                        
                        {/* Individual Dates Preview */}
                        {selectedDates.length <= 5 ? (
                          <div className="space-y-2">
                            {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map((date, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <CheckCircle2Icon className="h-4 w-4 text-primary flex-shrink-0" />
                                <span className="font-medium">{format(date, "MMM d, yyyy")}</span>
                                <span className="text-muted-foreground">({format(date, "EEE")})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                            {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map((date, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs py-1">
                                <CheckCircle2Icon className="h-3 w-3 text-primary flex-shrink-0" />
                                <span>{format(date, "MMM d")}</span>
                                <span className="text-muted-foreground">({format(date, "EEE")})</span>
                              </div>
                            ))}
                            <p className="text-xs text-muted-foreground text-center mt-2">
                              You can edit these in the next step
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No dates selected yet
                      </div>
                    )}
                  </div>

                  {/* Pricing Section */}
                  {selectedDates.length > 0 && isVenueLoaded && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Price per day ({selectedTimeSlot.label})
                          </span>
                          <span className="font-medium">
                            ₹{adjustedPrice.toLocaleString()}
                            {selectedTimeSlot.priceMultiplier !== 1 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (was ₹{basePrice.toLocaleString()})
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                          <span className="font-semibold">Estimated Total</span>
                          <span className="text-2xl font-bold text-primary">
                            ₹{totalPrice.toLocaleString()}
                          </span>
                        </div>

                        {isLoadingPricing && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <LoaderIcon className="h-3 w-3 animate-spin" />
                            <span>Calculating pricing...</span>
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          *Final amount includes taxes and may vary based on selected add-ons
                        </p>
                      </div>
                    </>
                  )}

                  {/* Continue Button */}
                  <div className="pt-4">
                    <Button
                      onClick={handleContinue}
                      disabled={selectedDates.length === 0 || isLoadingPricing}
                      className="w-full h-12 text-base bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                      size="lg"
                    >
                      <span>Continue to Event Details</span>
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </Button>

                    {selectedDates.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Select at least one date to continue
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}