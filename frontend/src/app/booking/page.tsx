/**
 * Booking Page - ENHANCED ERROR HANDLING & API RELIABILITY
 * 
 * Now includes:
 * - Comprehensive error handling and recovery
 * - API health monitoring
 * - Better user feedback for connection issues
 * - Graceful fallbacks when backend is unavailable
 * - Debug information for development
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { QuickDateShortcuts } from "@/components/booking/QuickDateShortcuts";
import { TimeSlotSelector, getDefaultTimeSlot, type TimeSlot } from "@/components/booking/TimeSlotSelector";
import { CalendarIcon, ArrowRightIcon, InfoIcon, CheckCircle2Icon, LoaderIcon, AlertCircleIcon, WifiOffIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { useBookingStore } from "@/stores";
import { useStepGuard } from "@/hooks/useStepGuard";
import { useRouter } from "next/navigation";
import { formatDateRangeCompact } from "@/lib/dates";
import { listVenues } from "@/lib/api/venues";
import { getVenueAvailability } from "@/lib/api/bookings";
import { useBookingPageSlots } from "@/hooks/useBookingPageSlots";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { ApiHealthCheck, ApiStatusIndicator } from "@/components/ApiHealthCheck";
import { checkApiHealth, ApiError } from "@/lib/api/client";

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

// Enhanced error state interface
interface ErrorState {
  hasError: boolean;
  message: string;
  code?: string;
  isRetryable: boolean;
  details?: string;
}

export default function BookingPage() {
  const router = useRouter();
  const { isValid } = useStepGuard('venue_selection');
  
  const {
    selectedVenue,
    selectedDates: storedDates,
    setSelectedDates,
    setVenueDetails,
  } = useBookingStore();
  
  const hasFetchedVenues = useRef(false);
  const hasFetchedAvailability = useRef(false);
  const retryCount = useRef(0);
  const maxRetries = 3;

  // Enhanced state management
  const [selectedDates, setSelectedDates_Local] = useState<Date[]>(normalizeDates(storedDates));
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [venues, setVenues] = useState<any[]>([]);
  const [currentVenue, setCurrentVenue] = useState<any>(selectedVenue);
  const [isLoadingVenues, setIsLoadingVenues] = useState(true);
  const [sessionAvailability, setSessionAvailability] = useState<Map<string, boolean>>(new Map());
  const [isLoadingSessionAvailability, setIsLoadingSessionAvailability] = useState(false);
  
  // Enhanced error states
  const [venueError, setVenueError] = useState<ErrorState>({ hasError: false, message: '', isRetryable: false });
  const [availabilityError, setAvailabilityError] = useState<ErrorState>({ hasError: false, message: '', isRetryable: false });
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [showApiHealth, setShowApiHealth] = useState(false);

  // SERVER TIMESLOTS INTEGRATION - Use server-configured slots and pricing
  const basePrice = currentVenue?.basePriceCents ? currentVenue.basePriceCents / 100 : 15000;
  const { activeSlots, selectedSlot, setSelectedSlotId, slotPricing } = useBookingPageSlots(
    currentVenue?.id,
    selectedDates,
    basePrice
  );

  const debouncedSelectedDates = useDebounce(selectedDates, 300);
  const isVenueLoaded = !!currentVenue && !venueError.hasError;
  const venueInfo = currentVenue;
  
  const isUnavailable = useCallback((date: Date) => {
    return unavailableDates.some(unavailable => 
      format(unavailable, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  }, [unavailableDates]);

  // Enhanced error handling helper
  const handleApiError = (error: any, type: 'venue' | 'availability') => {
    let errorState: ErrorState;
    
    if (error?.code === 'CONNECTION_FAILED' || error?.code === 'NETWORK_ERROR') {
      errorState = {
        hasError: true,
        message: 'Unable to connect to server',
        code: error.code,
        isRetryable: true,
        details: 'Please check if the backend server is running on http://localhost:3000'
      };
      setApiHealthy(false);
      setShowApiHealth(true);
    } else if (error?.status >= 500) {
      errorState = {
        hasError: true,
        message: 'Server error occurred',
        code: `HTTP_${error.status}`,
        isRetryable: true,
        details: error.message
      };
    } else if (error?.status >= 400) {
      errorState = {
        hasError: true,
        message: 'Invalid request',
        code: `HTTP_${error.status}`,
        isRetryable: false,
        details: error.message
      };
    } else {
      errorState = {
        hasError: true,
        message: error?.message || 'An unexpected error occurred',
        isRetryable: true,
        details: 'Please try again'
      };
    }

    if (type === 'venue') {
      setVenueError(errorState);
    } else {
      setAvailabilityError(errorState);
    }

    // Show toast for user feedback
    toast.error(errorState.message, {
      description: errorState.details,
      duration: 5000
    });
  };

  // Enhanced retry mechanism
  const retryOperation = async (operation: () => Promise<void>, type: 'venue' | 'availability') => {
    if (retryCount.current >= maxRetries) {
      toast.error('Maximum retries exceeded. Please check your connection.');
      return;
    }

    retryCount.current++;
    toast.info(`Retrying... (${retryCount.current}/${maxRetries})`);
    
    // Reset error state
    if (type === 'venue') {
      setVenueError({ hasError: false, message: '', isRetryable: false });
    } else {
      setAvailabilityError({ hasError: false, message: '', isRetryable: false });
    }
    
    await operation();
  };

  // Enhanced venue loading with error handling
  const loadVenues = async () => {
    try {
      setIsLoadingVenues(true);
      setVenueError({ hasError: false, message: '', isRetryable: false });
      
      const response = await listVenues();
      
      if (response.success && response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        setVenues(response.data.data);
        const venue = selectedVenue || response.data.data[0];
        setCurrentVenue(venue);
        retryCount.current = 0; // Reset retry count on success
        setApiHealthy(true);
        
        toast.success('Venues loaded successfully');
      } else {
        throw new Error(response.message || 'No venues available');
      }
    } catch (err) {
      console.error('Failed to fetch venues:', err);
      handleApiError(err, 'venue');
    } finally {
      setIsLoadingVenues(false);
    }
  };

  // Enhanced availability loading
  const fetchVenueAvailability = async () => {
    if (!currentVenue?.id) return;
    
    try {
      setIsLoadingAvailability(true);
      setAvailabilityError({ hasError: false, message: '', isRetryable: false });
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await getVenueAvailability(currentVenue.id, today, 90);
      
      if (response.success && response.data) {
        const bookedDates = response.data
          .filter(day => !day.isAvailable)
          .map(day => new Date(day.date));
        
        setUnavailableDates(bookedDates);
        retryCount.current = 0; // Reset retry count on success
      } else {
        throw new Error(response.message || 'Failed to load availability');
      }
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      handleApiError(error, 'availability');
      setUnavailableDates([]); // Use empty array as fallback
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  // Load venues on mount with enhanced error handling
  useEffect(() => {
    if (hasFetchedVenues.current) return;
    hasFetchedVenues.current = true;

    loadVenues();
    
    // Restore persisted dates
    const normalized = normalizeDates(storedDates);
    if (normalized.length > 0) {
      setSelectedDates_Local(normalized);
    }
  }, [selectedVenue, storedDates]);

  // Load availability when venue is ready
  useEffect(() => {
    if (isVenueLoaded && currentVenue?.id && !hasFetchedAvailability.current) {
      hasFetchedAvailability.current = true;
      void fetchVenueAvailability();
    }
  }, [isVenueLoaded, currentVenue?.id]);

  // Enhanced session availability checking
  useEffect(() => {
    if (selectedDates.length === 0 || !currentVenue?.id || activeSlots.length === 0) {
      setSessionAvailability(new Map());
      return;
    }

    const checkSessionAvailability = async () => {
      setIsLoadingSessionAvailability(true);
      
      try {
        const availability = new Map<string, boolean>();
        
        // Check each selected date for session availability
        for (const date of selectedDates) {
          const dateStr = format(date, 'yyyy-MM-dd');
          
          try {
            const response = await fetch(
              `/api/v1/bookings/venue/${currentVenue.id}/availability/slots?date=${dateStr}`,
              { 
                headers: { 
                  'Content-Type': 'application/json',
                  ...(typeof window !== 'undefined' && localStorage.getItem('token') 
                    ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    : {}
                  )
                } 
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data?.success && data?.data?.sessions && Array.isArray(data.data.sessions)) {
                data.data.sessions.forEach((session: any) => {
                  const key = `${dateStr}-${session.id}`;
                  availability.set(key, session.isAvailable !== false);
                });
              }
            }
          } catch (err) {
            console.warn(`Failed to check availability for ${dateStr}:`, err);
          }
        }
        
        setSessionAvailability(availability);
      } catch (err) {
        console.error('Failed to check session availability:', err);
      } finally {
        setIsLoadingSessionAvailability(false);
      }
    };

    void checkSessionAvailability();
  }, [debouncedSelectedDates, currentVenue?.id, activeSlots]);

  // Handle date selection with store sync
  const handleDateSelect = useCallback((dates: Date[]) => {
    setSelectedDates_Local(dates);
    setSelectedDates(dates);
    
    if (dates.length > 0) {
      toast.success(`${dates.length} day${dates.length !== 1 ? 's' : ''} selected`, { duration: 2000 });
    } else {
      toast.info('All dates cleared');
    }
  }, [setSelectedDates]);

  // Handle time slot change
  const handleTimeSlotChange = useCallback((timeSlot: TimeSlot) => {
    setSelectedSlotId(timeSlot.id);
    toast.success(`${timeSlot.label} selected`);
  }, [setSelectedSlotId]);

  // Check if any selected date has an unavailable session
  const getConflictingDates = useCallback((): Date[] => {
    if (!selectedSlot || activeSlots.length === 0) return [];
    
    const conflicts: Date[] = [];
    for (const date of selectedDates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const key = `${dateStr}-${selectedSlot.id}`;
      
      // If we have availability data for this date/session and it's unavailable
      if (sessionAvailability.has(key) && !sessionAvailability.get(key)) {
        conflicts.push(date);
      }
    }
    return conflicts;
  }, [selectedSlot, selectedDates, sessionAvailability, activeSlots]);

  // Enhanced continue handler
  const handleContinue = useCallback(() => {
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date for your event");
      return;
    }
    
    if (!venueInfo) {
      toast.error("Please wait for venue information to load");
      return;
    }

    if (!selectedSlot) {
      toast.error("Please select a time slot");
      return;
    }
    
    const conflicts = getConflictingDates();
    if (conflicts.length > 0) {
      const conflictDates = conflicts.map(d => format(d, 'MMM d')).join(', ');
      toast.error(`${selectedSlot.label} unavailable on: ${conflictDates}`);
      return;
    }
    
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    
    // Persist venue details with slotId for downstream pages
    setVenueDetails(
      venueInfo, 
      sorted, 
      selectedSlot.startTime, 
      selectedSlot.endTime,
      { slotId: selectedSlot.id } // Additional metadata
    );
    
    toast.success(
      `Proceeding with ${sorted.length} day${sorted.length !== 1 ? 's' : ''} • ${selectedSlot.label}`
    );
    router.push("/event-details");
  }, [selectedDates, selectedSlot, venueInfo, setVenueDetails, router, getConflictingDates]);

  // Use server pricing when available, fallback to local calculation
  const serverPricing = slotPricing?.data;
  const displayPrice = serverPricing?.averagePricePerDay || (selectedSlot ? Math.round(basePrice * selectedSlot.priceMultiplier) : basePrice);
  const totalPrice = serverPricing?.totalPrice || selectedDates.length * displayPrice;
  const appliedRates = serverPricing?.breakdown?.[0]?.appliedRates || [];
  
  // Enhanced loading states with error handling
  if (isLoadingVenues) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoaderIcon className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Loading Venues</h2>
            <p className="text-sm text-muted-foreground">Connecting to booking system...</p>
          </div>
          
          {/* Show API health status */}
          <div className="mt-4">
            <ApiStatusIndicator />
          </div>
        </div>
      </div>
    );
  }

  // Enhanced error state for no venues
  if (!isLoadingVenues && (venues.length === 0 || venueError.hasError)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-4">
            {venueError.code === 'CONNECTION_FAILED' ? (
              <WifiOffIcon className="h-16 w-16 mx-auto text-red-500" />
            ) : (
              <AlertCircleIcon className="h-16 w-16 mx-auto text-red-500" />
            )}
            
            <div>
              <h2 className="text-xl font-semibold text-destructive">
                {venueError.hasError ? venueError.message : 'No Venues Available'}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {venueError.details || 'Please check if the backend server is running.'}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {venueError.isRetryable && (
                <Button 
                  onClick={() => retryOperation(loadVenues, 'venue')} 
                  variant="outline" 
                  className="flex items-center gap-2"
                  disabled={retryCount.current >= maxRetries}
                >
                  <RefreshCwIcon className="h-4 w-4" />
                  Retry ({retryCount.current}/{maxRetries})
                </Button>
              )}
              
              <Button onClick={() => window.location.reload()} variant="outline">
                Refresh Page
              </Button>
            </div>
          </div>
          
          {/* Show API health check for debugging */}
          {showApiHealth && (
            <ApiHealthCheck 
              autoCheck={false} 
              onStatusChange={(status) => setApiHealthy(status.healthy)}
            />
          )}
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
          {/* Enhanced Header with API Status */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Select Your Event Dates & Time</h1>
                <p className="text-lg text-muted-foreground">Choose dates and duration for your event</p>
              </div>
              <ApiStatusIndicator className="self-start" />
            </div>
            
            {venueInfo && (
              <Badge variant="secondary" className="text-sm px-4 py-1">
                {venueInfo.name}
              </Badge>
            )}
            
            {/* Show error notifications */}
            {availabilityError.hasError && (
              <div className="mx-auto max-w-md">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-yellow-800">
                      <p className="font-medium">Availability data unavailable</p>
                      <p className="text-xs mt-1">{availabilityError.message}</p>
                      {availabilityError.isRetryable && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="mt-2 h-6 text-xs"
                          onClick={() => retryOperation(fetchVenueAvailability, 'availability')}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content - Rest remains the same but with enhanced error states */}
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

              {/* Time Slot Selection - SERVER INTEGRATED */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <Card className="border-2 shadow-xl bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {activeSlots.length > 0 ? 'Choose Your Session' : 'Choose Duration & Save Money'}
                    </CardTitle>
                    <CardDescription>
                      {activeSlots.length > 0 
                        ? 'Select from venue-configured time sessions'
                        : 'Save up to 40% with shorter sessions, or get full venue control with 24-hour access'
                      }
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Render server slots or fallback to defaults */}
                    <TimeSlotSelector
                      items={activeSlots.length > 0 ? activeSlots : undefined}
                      value={selectedSlot?.id || ''}
                      onChange={handleTimeSlotChange}
                      basePrice={basePrice}
                      disabled={isLoadingVenues || isLoadingSessionAvailability}
                      // Show availability status per session
                      sessionAvailability={sessionAvailability}
                      selectedDates={selectedDates}
                    />
                    
                    {activeSlots.length === 0 && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700">
                          ℹ️ Using default sessions. Admin can configure custom sessions for this venue.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Enhanced Booking Tips */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                    <InfoIcon className="h-5 w-5" />
                    {activeSlots.length > 0 ? 'Venue Sessions' : 'Pro Tips'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-blue-700">
                  {activeSlots.length > 0 ? (
                    <>
                      <p>• Sessions are configured by the venue owner</p>
                      <p>• Pricing includes venue-specific multipliers</p>
                      <p>• Unavailable sessions are automatically disabled</p>
                    </>
                  ) : (
                    <>
                      <p>• Morning & Evening sessions offer great savings</p>
                      <p>• Full Day gives you complete control and setup time</p>
                      <p>• You can modify your selection in the next step</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Summary - Enhanced with better error states */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-2 shadow-xl bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-sm sticky top-20">
                <CardHeader>
                  <CardTitle className="text-xl">Booking Summary</CardTitle>
                  <CardDescription>
                    {venueInfo?.name || 'Loading venue...'}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Time Slot Summary */}
                  {selectedSlot && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Selected Session</span>
                        <Badge variant="outline" className="text-xs">
                          {selectedSlot.duration ? `${selectedSlot.duration}h` : 'Session'}
                        </Badge>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2">
                          {selectedSlot.icon && <selectedSlot.icon className="h-4 w-4 text-primary" />}
                          <div>
                            <p className="text-sm font-semibold text-primary">{selectedSlot.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedSlot.startTime} - {selectedSlot.endTime}
                            </p>
                          </div>
                        </div>
                        {selectedSlot.priceMultiplier && selectedSlot.priceMultiplier < 1 && (
                          <Badge className="bg-green-100 text-green-700 text-[10px] mt-2">
                            {Math.round((1 - selectedSlot.priceMultiplier) * 100)}% savings
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  
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
                        {/* Date Range Display */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm font-medium text-primary">
                            {formatDateRangeCompact([...selectedDates].sort((a, b) => a.getTime() - b.getTime()))}
                          </p>
                        </div>
                        
                        {/* Individual Dates */}
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
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No dates selected yet
                      </div>
                    )}
                  </div>

                  {/* Session Availability Alerts */}
                  {selectedDates.length > 0 && selectedSlot && (
                    <>
                      {isLoadingSessionAvailability && (
                        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-center gap-2">
                          <LoaderIcon className="h-3 w-3 animate-spin" />
                          Checking session availability...
                        </div>
                      )}
                      {!isLoadingSessionAvailability && getConflictingDates().length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex gap-2 items-start">
                            <AlertCircleIcon className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-red-700">
                              <p className="font-medium">{selectedSlot.label} unavailable on:</p>
                              <p>{getConflictingDates().map(d => format(d, 'MMM d')).join(', ')}</p>
                              <p className="mt-1 text-red-600">Please choose different dates or session.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Pricing Section - SERVER INTEGRATED */}
                  {selectedDates.length > 0 && isVenueLoaded && selectedSlot && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        {/* Display server-computed applied rate multipliers */}
                        {appliedRates.length > 0 && (
                          <div className="space-y-2 text-xs">
                            <p className="font-medium text-muted-foreground">Applied Rates:</p>
                            <div className="space-y-1">
                              {appliedRates.map((rate: string, idx: number) => (
                                <div key={idx} className="flex justify-between text-muted-foreground">
                                  <span>{rate}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Price per day ({selectedSlot.label})
                          </span>
                          <span className="font-medium">
                            ₹{displayPrice.toLocaleString()}
                            {selectedSlot.priceMultiplier && selectedSlot.priceMultiplier !== 1 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (was ₹{basePrice.toLocaleString()})
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                          <span className="font-semibold">Total Amount</span>
                          <span className="text-2xl font-bold text-primary">
                            ₹{totalPrice.toLocaleString()}
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground text-center">
                          {serverPricing ? '*Pricing computed with all applicable rates' : '*Final amount includes taxes and may vary based on add-ons'}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Enhanced Continue Button */}
                  <div className="pt-4">
                    <Button
                      onClick={handleContinue}
                      disabled={
                        selectedDates.length === 0 || 
                        !selectedSlot || 
                        isLoadingSessionAvailability ||
                        getConflictingDates().length > 0 ||
                        venueError.hasError ||
                        !isVenueLoaded
                      }
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
                    
                    {getConflictingDates().length > 0 && (
                      <p className="text-xs text-center text-red-600 mt-2">
                        Session conflicts with selected dates - choose different dates or session
                      </p>
                    )}
                    
                    {venueError.hasError && (
                      <p className="text-xs text-center text-red-600 mt-2">
                        Please resolve venue loading issues first
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