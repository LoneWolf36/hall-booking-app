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

const normalizeDates = (arr?: any[]) =>
  (arr ?? []).map((d) => (d instanceof Date ? d : new Date(d)));

export default function BookingPage() {
  const router = useRouter();
  const { setVenueDetails, setSelectedDates, selectedDates: storedDates } = useBookingStore();

  // Normalize any persisted strings into Date objects to avoid getTime errors
  const [selectedDates, setSelectedDates_Local] = useState<Date[]>(normalizeDates(storedDates));

  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [pricing, setPricing] = useState<any>(null);

  // On mount, ensure storedDates are loaded into local state
  useEffect(() => {
    const normalized = normalizeDates(storedDates);
    if (normalized.length > 0) {
      setSelectedDates_Local(normalized);
      void calculatePricingForDates(normalized);
    }
  }, []); // Only on mount

  const venueInfo = {
    id: "venue-1",
    name: "Faisal Function Hall",
    basePriceCents: 1500000,
    capacity: 500,
    currency: "INR",
    timeZone: "Asia/Kolkata",
    isActive: true,
    paymentProfile: "hybrid" as const,
    allowCashPayments: true,
    requiresOnlineDeposit: false,
    depositAmount: 0,
    hasRazorpayAccount: true
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
    try {
      setIsLoadingPricing(true);
      // Calculate pricing locally using base price
      // Variable pricing API integration can be added later
      const basePrice = venueInfo.basePriceCents || 0;
      
      // Sort dates chronologically for better UX
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      
      const breakdown = sortedDates.map((date) => ({
        date: format(date, 'yyyy-MM-dd'),
        dayOfWeek: format(date, 'EEEE'),
        displayDate: format(date, 'MMM d, yyyy'), // User-friendly format
        basePrice: basePrice / 100,
        multiplier: 1,
        finalPrice: basePrice,
        appliedRates: [],
      }));

      setPricing({
        venueId: venueInfo.id,
        selectedDates: sortedDates.map((d) => format(d, 'yyyy-MM-dd')),
        breakdown,
        totalPrice: (basePrice * dates.length) / 100,
        averagePricePerDay: basePrice / 100,
      } as any);
    } catch (error) {
      console.error('Pricing calculation error:', error);
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

  const pricePerDay = venueInfo.basePriceCents / 100;
  const totalPrice =
    pricing?.totalPrice ?? selectedDates.length * pricePerDay;

  const sortedDates = useMemo(
    () => [...selectedDates].sort((a, b) => a.getTime() - b.getTime()),
    [selectedDates]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-12">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-8">
          <div className="text-center space-y-2 sm:space-y-3">
            <h1 className="text-2xl sm:text-4xl font-bold">Select Your Event Dates</h1>
            <p className="text-sm sm:text-lg text-muted-foreground">Choose one or multiple days for your event</p>
          </div>

          {/* Mobile: Single column, Desktop: 3 column grid */}
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-8 max-w-7xl">
            {/* Left: Calendar */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-6">
              <Card className="calendar-lg border-2 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl shadow-2xl overflow-hidden">
                <CardHeader className="px-3 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Event Calendar
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Tap dates to select
                  </CardDescription>
                </CardHeader>
                {/* Remove overflow-x-auto, constrain width properly */}
                <CardContent className="flex justify-center p-0">
                  <div className="w-full max-w-full">
                    <Calendar
                      mode="multiple"
                      locale={enGB}
                      selected={selectedDates}
                      onSelect={handleDateSelect}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      numberOfMonths={1}
                      className="w-full mx-auto scale-90 sm:scale-95 lg:scale-100 origin-center"
                      classNames={{
                        months: "w-full",
                        month: "w-full",
                        caption: "flex justify-center pt-1 relative items-center px-2",
                        caption_label: "text-xs sm:text-sm font-semibold",
                        nav: "space-x-1 flex items-center",
                        table: "w-full border-collapse",
                        head_row: "flex w-full",
                        head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.7rem] sm:text-xs flex-1",
                        row: "flex w-full mt-1",
                        cell: "relative p-0 text-center text-xs focus-within:relative focus-within:z-20 flex-1",
                        day: "h-8 w-full sm:h-9 text-xs sm:text-sm p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-50",
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
                  <CardTitle className="text-base sm:text-lg lg:text-xl">Booking Summary</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Faisal Function Hall</CardDescription>
                </CardHeader>
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
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
