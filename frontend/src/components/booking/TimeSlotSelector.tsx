/**
 * Time Slot Selector Component - Enhanced with Intelligent Venue Compatibility
 * 
 * Features:
 * - Intelligent detection of venue timeslot support via venue settings
 * - Full day booking for venues without timeslot support
 * - Smart pricing calculation with time-based multipliers
 * - Integration with backend via proper startTs/endTs conversion
 * - Visual indicators for venue compatibility
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClockIcon, SunriseIcon, SunIcon, MoonIcon, CalendarIcon, InfoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  duration: number;  // hours
  priceMultiplier: number; // 1.0 = base price, 0.6 = 60% of base price
  description: string;
  icon: React.ComponentType<any>;
  popular?: boolean;
  requiresSupport?: boolean; // true if venue must support timeslots
}

// Enhanced time slots with venue compatibility
const TIME_SLOTS: TimeSlot[] = [
  {
    id: 'morning',
    label: 'Morning',
    startTime: '06:00',
    endTime: '12:00',
    duration: 6,
    priceMultiplier: 0.6,
    description: 'Perfect for breakfast events, meetings',
    icon: SunriseIcon,
    requiresSupport: true,
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    startTime: '12:00',
    endTime: '18:00',
    duration: 6,
    priceMultiplier: 0.8,
    description: 'Great for lunch events, conferences',
    icon: SunIcon,
    requiresSupport: true,
  },
  {
    id: 'evening',
    label: 'Evening',
    startTime: '18:00',
    endTime: '00:00',
    duration: 6,
    priceMultiplier: 1.0,
    description: 'Ideal for dinner, parties, celebrations',
    icon: MoonIcon,
    popular: true,
    requiresSupport: true,
  },
  {
    id: 'full_day',
    label: 'Full Day',
    startTime: '00:00',
    endTime: '23:59',
    duration: 24,
    priceMultiplier: 1.5,
    description: 'Complete access for large events',
    icon: CalendarIcon,
    requiresSupport: false, // Always available
  },
];

export interface VenueTimeslotCapability {
  supportsTimeslots: boolean;
  supportedSlots?: string[]; // Array of slot IDs
  defaultSlot?: string;
  forcedFullDay?: boolean;
}

interface TimeSlotSelectorProps {
  value?: string;
  onChange: (slot: TimeSlot) => void;
  basePrice: number;
  className?: string;
  disabled?: boolean;
  venue?: {
    id: string;
    name: string;
    settings?: any;
  };
}

/**
 * Intelligent venue timeslot detection
 */
function getVenueTimeslotCapability(venue?: any): VenueTimeslotCapability {
  if (!venue?.settings) {
    // Default: assume full day only
    return {
      supportsTimeslots: false,
      defaultSlot: 'full_day',
      forcedFullDay: true,
    };
  }

  const settings = venue.settings;
  
  // Check explicit timeslot support configuration
  if (settings.timeslotSupport !== undefined) {
    return {
      supportsTimeslots: settings.timeslotSupport.enabled || false,
      supportedSlots: settings.timeslotSupport.allowedSlots || ['full_day'],
      defaultSlot: settings.timeslotSupport.defaultSlot || 'full_day',
      forcedFullDay: !settings.timeslotSupport.enabled,
    };
  }

  // Intelligent detection based on venue characteristics
  const capacity = venue.capacity || 0;
  const isLargeVenue = capacity > 200;
  const hasFlexiblePricing = settings.pricing?.weekendMultiplier || settings.pricing?.seasonalRates;
  
  // Large venues or venues with flexible pricing likely support timeslots
  const supportsTimeslots = isLargeVenue || hasFlexiblePricing || false;
  
  return {
    supportsTimeslots,
    supportedSlots: supportsTimeslots ? ['morning', 'afternoon', 'evening', 'full_day'] : ['full_day'],
    defaultSlot: supportsTimeslots ? 'evening' : 'full_day',
    forcedFullDay: !supportsTimeslots,
  };
}

export function TimeSlotSelector({ 
  value, 
  onChange, 
  basePrice, 
  className, 
  disabled = false,
  venue
}: TimeSlotSelectorProps) {
  const venueCapability = getVenueTimeslotCapability(venue);
  const [selectedSlot, setSelectedSlot] = useState<string>(value || venueCapability.defaultSlot || 'full_day');

  // Filter available slots based on venue capability
  const availableSlots = TIME_SLOTS.filter(slot => {
    if (!venueCapability.supportsTimeslots && slot.requiresSupport) {
      return false;
    }
    if (venueCapability.supportedSlots && !venueCapability.supportedSlots.includes(slot.id)) {
      return false;
    }
    return true;
  });

  const handleSlotChange = (slotId: string) => {
    const slot = TIME_SLOTS.find(s => s.id === slotId);
    if (slot) {
      setSelectedSlot(slotId);
      onChange(slot);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <ClockIcon className="h-4 w-4 text-primary" />
        <Label className="text-base font-medium">Event Duration</Label>
        {venue && (
          <Badge variant={venueCapability.supportsTimeslots ? 'default' : 'secondary'} className="text-[10px]">
            {venueCapability.supportsTimeslots ? 'Flexible timing' : 'Full day only'}
          </Badge>
        )}
      </div>
      
      {/* Venue capability notice */}
      {venue && venueCapability.forcedFullDay && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>{venue.name}</strong> operates on full-day bookings only. 
            You'll have complete access to the venue for the entire day.
          </AlertDescription>
        </Alert>
      )}
      
      <RadioGroup 
        value={selectedSlot} 
        onValueChange={handleSlotChange}
        disabled={disabled}
        className={cn(
          "grid gap-3",
          availableSlots.length <= 2 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
        )}
      >
        {availableSlots.map((slot) => {
          const adjustedPrice = Math.round(basePrice * slot.priceMultiplier);
          const savings = slot.priceMultiplier < 1 ? Math.round(basePrice * (1 - slot.priceMultiplier)) : 0;
          const isSelected = selectedSlot === slot.id;
          const IconComponent = slot.icon;
          
          return (
            <div key={slot.id} className="relative">
              <Label
                htmlFor={slot.id}
                className={cn(
                  'block cursor-pointer transition-all duration-200',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <Card className={cn(
                  'relative overflow-hidden transition-all duration-300 hover:shadow-lg',
                  isSelected 
                    ? 'ring-2 ring-primary border-primary bg-primary/5 shadow-md' 
                    : 'hover:border-primary/30 hover:bg-primary/2'
                )}>
                  {slot.popular && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-orange-500 text-white text-[10px] px-2 py-0.5">
                        Popular
                      </Badge>
                    </div>
                  )}
                  
                  {/* Full day badge for venues without timeslot support */}
                  {venueCapability.forcedFullDay && slot.id === 'full_day' && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-blue-500 text-white text-[10px] px-2 py-0.5">
                        Venue Standard
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <RadioGroupItem 
                          value={slot.id} 
                          id={slot.id}
                          disabled={disabled}
                          className="data-[state=checked]:border-primary" 
                        />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <IconComponent className={cn(
                            'h-5 w-5',
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          )} />
                          <CardTitle className="text-base">{slot.label}</CardTitle>
                        </div>
                        
                        <div className="mt-1 space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {slot.startTime} - {slot.endTime} ({slot.duration}h)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slot.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">
                          ₹{adjustedPrice.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">per day</span>
                      </div>
                      
                      {savings > 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">
                          Save ₹{savings.toLocaleString()}
                        </Badge>
                      )}
                      
                      {slot.priceMultiplier > 1 && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-[10px]">
                          Premium +{Math.round((slot.priceMultiplier - 1) * 100)}%
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      
      <div className="text-center">
        <p className="text-[11px] text-muted-foreground">
          🕰️ {venueCapability.supportsTimeslots 
            ? 'Choose the duration that fits your event needs' 
            : 'This venue provides full-day access for maximum flexibility'
          }
        </p>
      </div>
    </div>
  );
}

/**
 * Get time slot by ID
 */
export function getTimeSlotById(id: string): TimeSlot | null {
  return TIME_SLOTS.find(slot => slot.id === id) || null;
}

/**
 * Get default time slot based on venue capability
 */
export function getDefaultTimeSlot(venue?: any): TimeSlot {
  const capability = getVenueTimeslotCapability(venue);
  const defaultId = capability.defaultSlot || 'full_day';
  return TIME_SLOTS.find(slot => slot.id === defaultId) || TIME_SLOTS[TIME_SLOTS.length - 1];
}

/**
 * Convert time slot to backend-compatible timestamps for a given date
 */
export function timeSlotToTimestamps(date: Date, timeSlot: TimeSlot): { startTs: Date; endTs: Date } {
  const startTs = new Date(date);
  const endTs = new Date(date);
  
  // Parse start time
  const [startHour, startMinute] = timeSlot.startTime.split(':').map(Number);
  startTs.setHours(startHour, startMinute, 0, 0);
  
  // Parse end time
  const [endHour, endMinute] = timeSlot.endTime.split(':').map(Number);
  
  // Handle midnight crossing (e.g., 18:00 - 00:00)
  if (endHour === 0 && endMinute === 0) {
    endTs.setDate(endTs.getDate() + 1); // Next day
    endTs.setHours(0, 0, 0, 0);
  } else {
    endTs.setHours(endHour, endMinute, 0, 0);
  }
  
  return { startTs, endTs };
}

/**
 * Get all available time slots
 */
export function getAllTimeSlots(): TimeSlot[] {
  return [...TIME_SLOTS];
}

/**
 * Check if venue supports timeslots
 */
export function venueSupportsTimeslots(venue?: any): boolean {
  return getVenueTimeslotCapability(venue).supportsTimeslots;
}