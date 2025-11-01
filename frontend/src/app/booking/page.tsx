"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ArrowRightIcon, InfoIcon, CheckCircle2Icon, LoaderIcon } from "lucide-react";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { toast } from "sonner";
import { useBookingStore } from "@/stores";
import { useRouter } from "next/navigation";
import { calculatePricing } from "@/lib/api/venues";
import { getVenueAvailability } from "@/lib/api/bookings";

const normalizeDates = (arr?: any[]) =>
  (arr ?? []).map((d) => (d instanceof Date ? d : new Date(d)));

export default function BookingPage() {
  const router = useRouter();
  const { setVenueDetails, setSelectedDates, selectedDates: storedDates } = useBookingStore();

  // Normalize any persisted strings into Date objects to avoid getTime errors
  const [selectedDates, setSelectedDates_Local] = useState<Date[]>(normalizeDates(storedDates));

  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [pricing, setPricing] = useState<any>(null);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [venues, setVenues] = useState<any[]>([]);
  const [currentVenue, setCurrentVenue] = useState<any>(null);

  // Compute whether venue is loaded
  const isVenueLoaded = !!currentVenue;
  const venueInfo = currentVenue;

  // On mount, ensure storedDates are loaded into local state
  useEffect(() => {
    // Fetch venues first
    const fetchVenues = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/venues');
        const data = await response.json();
        console.log('Venues response:', data);
        if (data.success && data.data && data.data.length > 0) {
          setVenues(data.data);
          setCurrentVenue(data.data[0]);
        } else if (!data.success) {
          console.error('Venues API error:', data);
          toast.error('Failed to load venues');
        }
      } catch (err) {
        console.error('Failed to fetch venues:', err);
        toast.error('Failed to load venues. Please try again.');
      }
    };

    fetchVenues();
      
    const normalized = normalizeDates(storedDates);
    if (normalized.length > 0) {
      setSelectedDates_Local(normalized);
    }
  }, []);

  // Trigger availability/pricing fetch when venue loads
  useEffect(() => {
    if (isVenueLoaded && currentVenue?.id) {
      void fetchVenueAvailability();
      if (selectedDates.length > 0) {
        void calculatePricingForDates(selectedDates);
      }
    }
  }, [isVenueLoaded, currentVenue?.id, selectedDates.length]);

  // Fetch venue availability from backend
  const fetchVenueAvailability = async () => {
    if (!currentVenue?.id) return;
    
    try {
      setIsLoadingAvailability(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await getVenueAvailability(currentVenue.id, today, 90);
      
      // Extract unavailable dates from response
      const bookedDates = response.data!
        .filter(day => !day.isAvailable)
        .map(day => new Date(day.date));
      
      setUnavailableDates(bookedDates);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      toast.error('Could not load availability calendar');
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (!dates || dates.length === 0) {
      setSelectedDates_Local([]);
      setPricing(null);
      return;
    }
    const normalized = normalizeDates(dates);
    setSelectedDates_Local(normalized);
    void calculatePricingForDates(normalized);
  };

  const calculatePricingForDates = async (dates: Date[]) => {
    if (dates.length === 0 || !isVenueLoaded || !venueInfo?.id) return;
    
    try {
      setIsLoadingPricing(true);
      
      // Sort dates chronologically for better UX
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      
      // Call backend pricing API
      const response = await calculatePricing({
        venueId: venueInfo.id,
        selectedDates: sortedDates.map(d => format(d, 'yyyy-MM-dd')),
      });

      if (response.data) {
        setPricing(response.data);
      } else {
        // Fallback to local calculation if API fails
        const basePrice = venueInfo?.basePriceCents || 0;
        const breakdown = sortedDates.map((date) => ({
          date: format(date, 'yyyy-MM-dd'),
          dayOfWeek: format(date, 'EEEE'),
          displayDate: format(date, 'MMM d, yyyy'),
          basePrice: basePrice / 100,
          multiplier: 1,
          finalPrice: basePrice,
          appliedRates: [],
        }));

        setPricing({
          venueId: venueInfo!.id,
          selectedDates: sortedDates.map((d) => format(d, 'yyyy-MM-dd')),
          breakdown,
          totalPrice: (basePrice * dates.length) / 100,
          averagePricePerDay: basePrice / 100,
        });
      }
    } catch (error) {
      console.error('Pricing calculation error:', error);
      toast.error('Failed to calculate pricing. Using base rate.');
      
      // Fallback pricing
      const basePrice = venueInfo?.basePriceCents || 0;
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      setPricing({
        venueId: venueInfo!.id,
        totalPrice: (basePrice * dates.length) / 100,
        averagePricePerDay: basePrice / 100,
      });
    } finally {
      setIsLoadingPricing(false);
    }
  };

  const handleContinue = () => {
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date for your event");
      return;
    }
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const startDate = sorted[0];

    setSelectedDates(sorted);
    setVenueDetails(venueInfo, startDate, "00:00", "23:59");

    toast.success(`${sorted.length} day(s) selected`);
    router.push("/event-details");
  };

  const pricePerDay = venueInfo?.basePriceCents ? venueInfo.basePriceCents / 100 : 0;
  const totalPrice =
    pricing?.totalPrice ?? (isVenueLoaded && venueInfo ? selectedDates.length * pricePerDay : 0);

  const sortedDates = useMemo(
    () => [...selectedDates].sort((a, b) => a.getTime() - b.getTime()),
    [selectedDates]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-12 max-w-7xl">
        <div className="w-full max-w-full space-y-4 sm:space-y-8">
          <div className="text-center space-y-2 sm:space-y-3">
            <h1 className="text-2xl sm:text-4xl font-bold">Select Your Event Dates</h1>
            <p className="text-sm sm:text-lg text-muted-foreground">Choose one or multiple days for your event</p>
          </div>

          {/* Mobile: Single column, Desktop: 3 column grid */}
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 w-full max-w-full">
            {/* Left: Calendar */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-6">
              <Card className="calendar-lg border-2 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl shadow-2xl overflow-hidden">
                <CardHeader className="px-3 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Event Calendar
                    {isLoadingAvailability && (
                      <LoaderIcon className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {isLoadingAvailability ? 'Loading availability...' : 'Tap dates to select'}
                  </CardDescription>
                </CardHeader>
                {/* Responsive calendar container */}
                <CardContent className="flex justify-center p-2 sm:p-4 overflow-hidden">
                  <div className="w-full max-w-full">
                    <Calendar
                      mode="multiple"
                      locale={enGB}
                      selected={selectedDates}
                      onSelect={handleDateSelect}
                      disabled={(date) => {
                        // Disable past dates
                        if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                        
                        // Disable already booked dates
                        return unavailableDates.some(
                          unavailable => format(unavailable, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                        );
                      }}
                      numberOfMonths={1}
                      className="w-full mx-auto"
                      classNames={{
                        months: "w-full",
                        month: "w-full space-y-2 sm:space-y-4",
                        caption: "flex justify-center pt-1 relative items-center px-1 sm:px-2",
                        caption_label: "text-sm sm:text-base font-semibold",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex w-full",
                        head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.65rem] sm:text-xs flex-1 min-h-[28px] sm:min-h-[32px] flex items-center justify-center",
                        row: "flex w-full mt-1 sm:mt-2",
                        cell: "relative p-0 text-center text-xs sm:text-sm focus-within:relative focus-within:z-20 flex-1 min-h-[32px] sm:min-h-[36px]",
                        day: "h-8 w-full sm:h-10 text-xs sm:text-sm p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors min-h-[32px] sm:min-h-[40px] flex items-center justify-center",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground font-semibold",
                        day_outside: "text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-30 line-through",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20 backdrop-blur-sm hidden sm:block">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <InfoIcon className="h-4 w-4" />
                    Booking Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>• Select consecutive dates for multi-day events</p>
                  <p>• Each day is a full 24-hour booking</p>
                  <p>• You can select non-consecutive dates for flexibility</p>
                  <p>• Pricing is per day selected</p>
                </CardContent>
              </Card>
            </div>

            {/* Right: Summary - Hidden on mobile, shows below calendar on tablet, sticky on desktop */}
            <div className="lg:col-span-1 lg:sticky lg:top-20">
              <Card className="border-2 bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg lg:text-xl">
                    Booking Summary
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {isVenueLoaded && venueInfo?.name ? venueInfo.name : 'Loading venue...'}
                  </CardDescription>
                </CardHeader>
                {isVenueLoaded && venueInfo ? (
                <CardContent className="space-y-4 sm:space-y-6 pb-20 lg:pb-6">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Selected Dates</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedDates.length} {selectedDates.length === 1 ? "day" : "days"}
                      </Badge>
                    </div>

                    {sortedDates.length > 0 ? (
                      <div className="space-y-1 sm:space-y-2 max-h-40 sm:max-h-60 overflow-y-auto bg-muted/30 rounded-lg p-2 sm:p-3">
                        {sortedDates.map((date, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2Icon className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                            <span className="font-medium">{format(date, "MMM d, yyyy")}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 sm:py-6 text-muted-foreground text-xs sm:text-sm">
                        No dates selected yet
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 sm:space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Price per day</span>
                      <span className="font-medium">₹{pricePerDay.toLocaleString()}</span>
                    </div>

                    {selectedDates.length > 0 && (
                      <>
                        {pricing?.breakdown && (
                          <div className="text-xs text-muted-foreground bg-primary/5 p-2 rounded border border-primary/20 max-h-32 sm:max-h-40 overflow-y-auto">
                            <p className="font-semibold text-foreground mb-1 sm:mb-2">Pricing Breakdown:</p>
                            {pricing.breakdown.map((day: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs mb-1 items-center">
                                <span className="text-foreground font-medium">
                                  {day.displayDate || day.date} 
                                  <span className="text-muted-foreground ml-1">({day.dayOfWeek.substring(0, 3)})</span>
                                </span>
                                <span className="font-semibold">
                                  ₹{(day.finalPrice / 100).toLocaleString()}
                                  {day.appliedRates.length > 0 && (
                                    <span className="text-green-600 dark:text-green-400 ml-1 text-[0.65rem]">
                                      ({day.appliedRates.join(", ")})
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">
                            {selectedDates.length} {selectedDates.length === 1 ? "day" : "days"} × ₹{pricePerDay.toLocaleString()}
                          </span>
                          <span className="font-medium">₹{totalPrice.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t">
                          <span className="font-semibold text-sm sm:text-base">Estimated Total</span>
                          <span className="text-xl sm:text-2xl font-bold text-primary">₹{totalPrice.toLocaleString()}</span>
                        </div>

                        {isLoadingPricing && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <LoaderIcon className="h-3 w-3 animate-spin" />
                            Updating pricing...
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          *Final amount may include additional services and taxes
                        </p>
                      </>
                    )}
                  </div>

                  <div className="sticky bottom-4 left-0 right-0 p-3 sm:p-4 lg:p-0 bg-card/95 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none border-t lg:border-t-0 border-border/60 lg:border-border rounded-xl lg:rounded-none shadow-lg lg:shadow-none z-50">
                    <Button
                      onClick={handleContinue}
                      disabled={selectedDates.length === 0}
                      className="w-full h-10 sm:h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300 font-medium rounded-xl text-xs sm:text-sm"
                      size="lg"
                    >
                      Continue to Event Details
                      <ArrowRightIcon className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>

                    {selectedDates.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Select dates to continue
                      </p>
                    )}
                  </div>
                </CardContent>
              ) : (
                <CardContent className="space-y-4 sm:space-y-6 pb-20 lg:pb-6">
                  <div className="flex items-center justify-center py-8">
                    <LoaderIcon className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading venue information...</span>
                  </div>
                </CardContent>
              )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

