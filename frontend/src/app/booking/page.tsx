"use client"

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  ArrowRightIcon,
  InfoIcon,
  CheckCircle2Icon
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useBookingStore } from "@/stores";
import { useRouter } from "next/navigation";

export default function BookingPage() {
  const router = useRouter();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const { setVenueDetails } = useBookingStore();

  // Venue info (would come from configuration/API in production)
  const venueInfo = {
    id: "venue-1",
    name: "Grand Celebration Hall",
    basePriceCents: 1500000, // ₹15,000 per day
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
    if (dates) {
      setSelectedDates(dates);
    }
  };

  const handleContinue = () => {
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date for your event");
      return;
    }

    // Sort dates
    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Save to booking store
    setVenueDetails(
      venueInfo,
      startDate,
      "00:00", // Full day event
      "23:59"  // Full day event
    );

    toast.success(`${selectedDates.length} day(s) selected`);
    router.push("/event-details");
  };

  const totalPrice = selectedDates.length * (venueInfo.basePriceCents / 100);
  const pricePerDay = venueInfo.basePriceCents / 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold">Select Your Event Dates</h1>
            <p className="text-lg text-muted-foreground">
              Choose one or multiple days for your event
            </p>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left Side - Calendar */}
            <div className="lg:col-span-3 space-y-4 sm:space-y-6">
              <Card className="border-2 bg-card/40 backdrop-blur-xl shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    Event Calendar
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Click dates to select. Click again to deselect.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center p-4 sm:p-6">
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={handleDateSelect}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    numberOfMonths={1}
                    className="rounded-lg"
                    classNames={{
                      months: "flex flex-col sm:flex-row gap-6",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-base font-semibold",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-8 w-8 bg-transparent hover:opacity-100",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-10 font-medium text-sm",
                      row: "flex w-full mt-2",
                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                      day: "h-10 w-10 p-0 font-normal aria-selected:opacity-100",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible",
                    }}
                  />
                </CardContent>
              </Card>

              {/* Tips Card */}
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

            {/* Right Side - Summary */}
            <div className="lg:col-span-2">
              {/* Desktop: Sticky card, Mobile: Fixed bottom */}
              <Card className="border-2 lg:sticky lg:top-20 bg-card/60 backdrop-blur-2xl shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Booking Summary</CardTitle>
                  <CardDescription className="text-sm">{venueInfo.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 pb-20 lg:pb-6">
                  {/* Selected Dates */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Selected Dates</span>
                      <Badge variant="secondary">
                        {selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'}
                      </Badge>
                    </div>
                    
                    {selectedDates.length > 0 ? (
                      <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto bg-muted/30 rounded-lg p-3">
                        {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map((date, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <CheckCircle2Icon className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-medium">
                              {format(date, "EEEE, MMMM d, yyyy")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No dates selected yet
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Price per day</span>
                      <span className="font-medium">₹{pricePerDay.toLocaleString()}</span>
                    </div>
                    
                    {selectedDates.length > 0 && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'} × ₹{pricePerDay.toLocaleString()}
                          </span>
                          <span className="font-medium">₹{totalPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t">
                          <span className="font-semibold">Estimated Total</span>
                          <span className="text-2xl font-bold text-primary">
                            ₹{totalPrice.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          *Final amount may include additional services and taxes
                        </p>
                      </>
                    )}
                  </div>

                  {/* Continue Button - Sticky on Both Mobile and Desktop */}
                  <div className="sticky bottom-4 left-0 right-0 p-4 lg:p-0 bg-card/95 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none border-t lg:border-t-0 border-border/60 lg:border-border rounded-xl lg:rounded-none shadow-lg lg:shadow-none z-50">
                    <Button 
                      onClick={handleContinue}
                      disabled={selectedDates.length === 0}
                      className="w-full h-12 sm:h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300 font-medium rounded-xl"
                      size="lg"
                    >
                      Continue to Event Details
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
