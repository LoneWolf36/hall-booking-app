"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircleIcon, XCircleIcon, ClockIcon, UsersIcon, CreditCardIcon } from "lucide-react";
import { AvailabilityResponse, AvailabilityService } from "@/services/availability.service";

interface AvailabilityResultProps {
  result: AvailabilityResponse;
  selectedDate: string;
  selectedStartTime: string;
  selectedEndTime: string;
  onBookNow?: () => void;
}

export function AvailabilityResult({
  result,
  selectedDate,
  selectedStartTime,
  selectedEndTime,
  onBookNow
}: AvailabilityResultProps) {
  const { available, conflicts, suggestedSlots, venue } = result;
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {available ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            ) : (
              <XCircleIcon className="h-6 w-6 text-red-600" />
            )}
            <div>
              <CardTitle className="text-lg">
                {available ? "Available ✅" : "Not Available ❌"}
              </CardTitle>
              <CardDescription>
                {venue.name} - {AvailabilityService.formatDate(selectedDate)}
              </CardDescription>
            </div>
          </div>
          <Badge variant={available ? "default" : "destructive"}>
            {available ? "Open" : "Booked"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Requested Time Slot */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClockIcon className="h-4 w-4" />
          <span>
            Requested: {AvailabilityService.formatTime(`2000-01-01T${selectedStartTime}:00`)} - {AvailabilityService.formatTime(`2000-01-01T${selectedEndTime}:00`)}
          </span>
        </div>
        
        {/* Venue Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
            <span>Capacity: {venue.capacity} people</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
            <span>₹{venue.hourlyRate}/hour</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Duration: {calculateDuration(selectedStartTime, selectedEndTime)}</span>
          </div>
        </div>
        
        {venue.description && (
          <p className="text-sm text-muted-foreground">{venue.description}</p>
        )}
        
        {/* Conflicts Section */}
        {!available && conflicts && conflicts.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm mb-2">Existing Bookings:</h4>
              <div className="space-y-2">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="bg-red-50 dark:bg-red-900/10 p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Booking #{conflict.bookingNumber}</span>
                      <Badge variant="destructive" className="text-xs">Conflicting</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {AvailabilityService.formatTime(conflict.startTime)} - {AvailabilityService.formatTime(conflict.endTime)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Suggested Slots */}
        {!available && suggestedSlots && suggestedSlots.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm mb-2">Suggested Alternative Times:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestedSlots.slice(0, 4).map((slot, index) => (
                  <div key={index} className="bg-green-50 dark:bg-green-900/10 p-2 rounded-md">
                    <div className="text-sm font-medium text-green-800 dark:text-green-200">
                      {AvailabilityService.formatTime(slot.startTime)} - {AvailabilityService.formatTime(slot.endTime)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {available && onBookNow && (
            <Button onClick={onBookNow} className="flex-1">
              Book This Slot
            </Button>
          )}
          {!available && (
            <Button variant="outline" className="flex-1" disabled>
              Not Available
            </Button>
          )}
        </div>
        
        {/* Estimated Cost */}
        {available && (
          <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-md">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Estimated Cost:</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                ₹{calculateEstimatedCost(selectedStartTime, selectedEndTime, venue.hourlyRate)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Base rate • Additional charges may apply
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function calculateDuration(startTime: string, endTime: string): string {
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours === 0) {
    return `${diffMins} minutes`;
  } else if (diffMins === 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else {
    return `${diffHours}h ${diffMins}m`;
  }
}

function calculateEstimatedCost(startTime: string, endTime: string, hourlyRate: number): number {
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return Math.round(diffHours * hourlyRate);
}
