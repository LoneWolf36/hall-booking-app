/**
 * Simplified Booking Page - No Custom Hold System
 * 
 * Uses the existing backend booking system instead of custom hold endpoints.
 * Creates bookings in 'temp_hold' status using existing createBooking API.
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { CalendarIcon, ArrowRightIcon, InfoIcon, CheckCircle2Icon, LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import { useBookingStore } from "@/stores";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { formatDateRangeCompact } from "@/lib/dates";
import { calculatePricing, listVenues } from "@/lib/api/venues";
import { getVenueAvailability } from "@/lib/api/bookings";
import { motion } from "framer-motion";
import { format } from "date-fns";

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
  const { token } = useAuthStore();
  const { selectedVenue, selectedDates: storedDates, setSelectedDates, setVenueDetails } = useBookingStore();
  
  const hasFetchedVenues = useRef(false);
  const hasFetchedAvailability = useRef(false);

  // Local state  
  const [selectedDates, setSelectedDates_Local] = useState<Date[]>(normalizeDates(storedDates));
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [pricing, setPricing] = useState<any>(null);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [venues, setVenues] = useState<any[]>([]);
  const [currentVenue, setCurrentVenue] = useState<any>(selectedVenue);
  const [isLoadingVenues, setIsLoadingVenues] = useState(true);

  const debouncedSelectedDates = useDebounce(selectedDates, 500);
  const isVenueLoaded = !!currentVenue;
  const venueInfo = currentVenue;
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  
  const isUnavailable = useCallback((date: Date) => {
    return unavailableDates.some(unavailable => 
      format(unavailable, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  }, [unavailableDates]);

  // Load venues
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
    const normalized = normalizeDates(storedDates);
    if (normalized.length > 0) setSelectedDates_Local(normalized);
  }, [selectedVenue, storedDates]);

  // Load availability
  useEffect(() => {
    if (isVenueLoaded && currentVenue?.id && !hasFetchedAvailability.current) {
      hasFetchedAvailability.current = true;
      void fetchVenueAvailability();
    }
  }, [isVenueLoaded, currentVenue?.id]);

  // Calculate pricing
  useEffect(() => {
    if (debouncedSelectedDates.length > 0 && isVenueLoaded && currentVenue?.id) {
      void calculatePricingForDates(debouncedSelectedDates);
    }
  }, [debouncedSelectedDates, isVenueLoaded, currentVenue?.id]);

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

  const calculatePricingForDates = async (dates: Date[]) => {
    if (dates.length === 0 || !isVenueLoaded || !venueInfo?.id) return;
    
    // Skip if same dates
    const currentDateStrings = dates.map(d => format(d, 'yyyy-MM-dd')).sort();
    const existingDateStrings = pricing?.selectedDates?.sort();
    if (existingDateStrings && 
        currentDateStrings.length === existingDateStrings.length &&
        currentDateStrings.every((date, idx) => date === existingDateStrings[idx])) {
      return;
    }
    
    try {
      setIsLoadingPricing(true);
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      
      const response = await calculatePricing({
        venueId: venueInfo.id,
        selectedDates: sortedDates.map(d => format(d, 'yyyy-MM-dd')),
      });

      if (response.success && response.data) {
        setPricing(response.data);
      } else {
        // Fallback
        const basePrice = venueInfo?.basePriceCents || 0;
        setPricing({
          venueId: venueInfo!.id,
          totalPrice: (basePrice * dates.length) / 100,
          averagePricePerDay: basePrice / 100,
        });
      }
    } catch (error) {
      console.error('Pricing calculation error:', error);
      const basePrice = venueInfo?.basePriceCents || 0;
      setPricing({
        venueId: venueInfo!.id,
        totalPrice: (basePrice * dates.length) / 100,
        averagePricePerDay: basePrice / 100,
      });
    } finally {
      setIsLoadingPricing(false);
    }
  };

  // Handle date selection (simplified - just update state)
  const handleDateSelect = useCallback(async (dates: Date[]) => {
    setSelectedDates_Local(dates);
    setSelectedDates(dates);
    
    if (dates.length > 0) {
      toast.success(`${dates.length} day${dates.length !== 1 ? 's' : ''} selected`, { duration: 2000 });
    }
  }, [setSelectedDates]);

  // Continue to next step
  const handleContinue = useCallback(() => {
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date for your event");
      return;
    }
    
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const startDate = sorted[0];

    setVenueDetails(venueInfo, startDate, "00:00", "23:59");
    toast.success(`Proceeding with ${sorted.length} day${sorted.length !== 1 ? 's' : ''} selected`);
    router.push("/event-details");
  }, [selectedDates, venueInfo, setVenueDetails, router]);

  // Calculate display values
  const pricePerDay = venueInfo?.basePriceCents ? venueInfo.basePriceCents / 100 : 0;
  const totalPrice = pricing?.totalPrice ?? (isVenueLoaded && venueInfo ? selectedDates.length * pricePerDay : 0);
  
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Select Your Event Dates</h1>
            <p className="text-lg text-muted-foreground">Choose one or multiple days for your event</p>
            {venueInfo && (
              <Badge variant="secondary" className="text-sm px-4 py-1">
                Booking for: {venueInfo.name}
              </Badge>
            )}
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: Calendar */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="border-2 shadow-xl bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle className="text-xl">Event Calendar</CardTitle>
                        <CardDescription>
                          {isLoadingAvailability ? 'Loading availability...' : 'Select your event dates'}
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

              {/* Tips */}
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <InfoIcon className="h-5 w-5" />
                    Booking Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>• Select consecutive dates for multi-day events to get better rates</p>
                  <p>• Each day is a full 24-hour booking (00:00 - 23:59)</p>
                  <p>• Pricing may vary by day (weekends typically cost more)</p>
                  <p>• Booking will be confirmed after payment completion</p>
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
                  {/* Selected Dates */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Selected Dates</span>
                      <Badge variant="secondary">
                        {selectedDates.length} {selectedDates.length === 1 ? "day" : "days"}
                      </Badge>
                    </div>

                    {selectedDates.length > 0 ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm font-medium text-primary">
                            {formatDateRangeCompact([...selectedDates].sort((a, b) => a.getTime() - b.getTime()))}
                          </p>
                        </div>
                        
                        {selectedDates.length <= 3 ? (
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
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No dates selected yet
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  {selectedDates.length > 0 && isVenueLoaded && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Price per day</span>
                        <span className="font-medium">₹{pricePerDay.toLocaleString()}</span>
                      </div>

                      {pricing?.breakdown && (
                        <div className="text-xs bg-muted/50 p-3 rounded-lg border max-h-40 overflow-y-auto">
                          <p className="font-semibold text-foreground mb-2">Pricing Breakdown:</p>
                          {pricing.breakdown.map((day: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center mb-1">
                              <span className="text-foreground font-medium">
                                {day.displayDate || format(new Date(day.date), 'MMM d')}
                                <span className="text-muted-foreground ml-1">({format(new Date(day.date), 'EEE')})</span>
                              </span>
                              <span className="font-semibold">
                                ₹{(day.finalPrice / 100).toLocaleString()}
                                {day.appliedRates?.length > 0 && (
                                  <span className="text-green-600 dark:text-green-400 ml-1 text-[10px]">
                                    ({day.appliedRates.join(", ")})
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className="font-semibold">Estimated Total</span>
                        <span className="text-2xl font-bold text-primary">
                          ₹{totalPrice.toLocaleString()}
                        </span>
                      </div>

                      {isLoadingPricing && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <LoaderIcon className="h-3 w-3 animate-spin" />
                          <span>Updating pricing...</span>
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        *Final amount includes taxes and may vary based on selected add-ons
                      </p>
                    </div>
                  )}

                  {/* Continue Button */}
                  <div className="pt-4">
                    <Button
                      onClick={handleContinue}
                      disabled={selectedDates.length === 0}
                      className="w-full h-12 text-base bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                      size="lg"
                    >
                      <span>Continue to Event Details</span>
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </Button>

                    {selectedDates.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Select dates to continue
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