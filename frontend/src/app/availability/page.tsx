"use client"

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { AvailabilityResult } from "@/components/availability-result";
import { AvailabilityService, AvailabilityRequest, AvailabilityResponse } from "@/services/availability.service";
import { CalendarIcon, SearchIcon, MapPinIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AvailabilityPage() {
  const [selectedVenue, setSelectedVenue] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [searchResults, setSearchResults] = useState<AvailabilityResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch available venues
  const { data: venues, isLoading: venuesLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: AvailabilityService.getVenues,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleSearch = async () => {
    if (!selectedVenue || !selectedDate || !startTime || !endTime) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate time slot
    const validation = AvailabilityService.validateTimeSlot(startTime, endTime);
    if (!validation.isValid) {
      toast.error(validation.error || "Invalid time slot");
      return;
    }

    setIsSearching(true);
    try {
      const request: AvailabilityRequest = {
        venueId: selectedVenue,
        date: format(selectedDate, "yyyy-MM-dd"),
        startTime,
        endTime,
      };

      const result = await AvailabilityService.checkAvailability(request);
      setSearchResults(result);
      
      if (result.available) {
        toast.success("Great! This time slot is available!");
      } else {
        toast.info("This time slot is not available. Check suggested alternatives.");
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error("Failed to check availability. Please try again.");
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookNow = () => {
    toast.info("Login required to complete booking. Feature coming soon!");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Check Availability</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find the perfect time slot for your event. No login required - just search and see what's available!
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="h-5 w-5" />
              Search Availability
            </CardTitle>
            <CardDescription>
              Select a venue, date, and time to check availability
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Venue Selection */}
            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              {venuesLoading ? (
                <div className="flex items-center gap-2 p-2">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">Loading venues...</span>
                </div>
              ) : (
                <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues?.map((venue: any) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{venue.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ₹{venue.hourlyRate}/hr • {venue.capacity} people
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={`w-full justify-start text-left font-normal ${
                      !selectedDate && "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  min="06:00"
                  max="23:59"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  min="06:00"
                  max="23:59"
                />
              </div>
            </div>

            {/* Search Button */}
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !selectedVenue || !selectedDate || !startTime || !endTime}
              className="w-full"
              size="lg"
            >
              {isSearching ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Checking Availability...
                </>
              ) : (
                <>
                  <SearchIcon className="mr-2 h-4 w-4" />
                  Check Availability
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Search Results */}
        {searchResults && (
          <AvailabilityResult
            result={searchResults}
            selectedDate={format(selectedDate!, "yyyy-MM-dd")}
            selectedStartTime={startTime}
            selectedEndTime={endTime}
            onBookNow={handleBookNow}
          />
        )}

        {/* How it works */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="bg-blue-100 dark:bg-blue-900/20 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                </div>
                <h3 className="font-medium mb-2">Select Details</h3>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred venue, date, and time slot
                </p>
              </div>
              <div>
                <div className="bg-green-100 dark:bg-green-900/20 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 dark:text-green-400 font-bold">2</span>
                </div>
                <h3 className="font-medium mb-2">Check Availability</h3>
                <p className="text-sm text-muted-foreground">
                  We'll check real-time availability against existing bookings
                </p>
              </div>
              <div>
                <div className="bg-purple-100 dark:bg-purple-900/20 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <span className="text-purple-600 dark:text-purple-400 font-bold">3</span>
                </div>
                <h3 className="font-medium mb-2">Book or Browse</h3>
                <p className="text-sm text-muted-foreground">
                  Book the slot if available, or explore suggested alternatives
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Why Choose Our Platform?</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">Zero Double-Bookings</Badge>
            <Badge variant="secondary">Real-time Availability</Badge>
            <Badge variant="secondary">Flexible Payments</Badge>
            <Badge variant="secondary">Instant Confirmation</Badge>
            <Badge variant="secondary">Mobile Friendly</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
