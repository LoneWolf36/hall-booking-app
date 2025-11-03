/**
 * Time Slot Selector - SERVER INTEGRATED VERSION
 * 
 * Now supports server-configured sessions with availability checking.
 * Maintains backward compatibility with default options.
 */

'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClockIcon, SunIcon, MoonIcon, CalendarIcon, AlertCircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  duration: number;
  priceMultiplier: number;
  description: string;
  icon: React.ComponentType<any>;
  savingsText?: string;
  popular?: boolean;
}

// Default slots as fallback when no server config
const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  {
    id: 'morning_session',
    label: 'Morning Session',
    startTime: '09:00',
    endTime: '15:00',
    duration: 6,
    priceMultiplier: 0.6,
    description: '6 hours • Perfect for breakfast events, meetings',
    icon: SunIcon,
    savingsText: '40% OFF',
  },
  {
    id: 'evening_session', 
    label: 'Evening Session',
    startTime: '16:00',
    endTime: '22:00',
    duration: 6,
    priceMultiplier: 0.8,
    description: '6 hours • Great for dinner, parties, celebrations',
    icon: MoonIcon,
    savingsText: '20% OFF',
    popular: true,
  },
  {
    id: 'full_day',
    label: 'Full Day Access',
    startTime: '00:00',
    endTime: '23:59',
    duration: 24,
    priceMultiplier: 1.0,
    description: '24 hours • Complete venue control, includes setup time',
    icon: CalendarIcon,
  },
];

interface TimeSlotSelectorProps {
  items?: TimeSlot[]; // Server-configured slots (optional)
  value?: string;
  onChange: (slot: TimeSlot) => void;
  basePrice: number;
  className?: string;
  disabled?: boolean;
  sessionAvailability?: Map<string, boolean>; // Per date-slot availability
  selectedDates?: Date[]; // To check availability across dates
}

export function TimeSlotSelector({ 
  items,
  value, 
  onChange, 
  basePrice, 
  className, 
  disabled = false,
  sessionAvailability,
  selectedDates = []
}: TimeSlotSelectorProps) {
  const slots = items && items.length > 0 ? items : DEFAULT_TIME_SLOTS;
  const [selectedSlot, setSelectedSlot] = useState<string>(value || slots[0]?.id || 'full_day');

  const handleSlotChange = (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot) {
      setSelectedSlot(slotId);
      onChange(slot);
    }
  };

  // Check if a session is available across all selected dates
  const isSessionAvailable = (sessionId: string): boolean => {
    if (!sessionAvailability || selectedDates.length === 0) return true;
    
    return selectedDates.every(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const key = `${dateStr}-${sessionId}`;
      return !sessionAvailability.has(key) || sessionAvailability.get(key) === true;
    });
  };

  // Get conflicting dates for a session
  const getConflictingDates = (sessionId: string): Date[] => {
    if (!sessionAvailability || selectedDates.length === 0) return [];
    
    return selectedDates.filter(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const key = `${dateStr}-${sessionId}`;
      return sessionAvailability.has(key) && sessionAvailability.get(key) === false;
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <ClockIcon className="h-4 w-4 text-primary" />
        <Label className="text-base font-medium">
          {items && items.length > 0 ? 'Available Sessions' : 'Choose Your Booking Duration'}
        </Label>
      </div>
      
      <RadioGroup 
        value={selectedSlot} 
        onValueChange={handleSlotChange}
        disabled={disabled}
        className="space-y-3"
      >
        {slots.map((slot) => {
          const adjustedPrice = Math.round(basePrice * slot.priceMultiplier);
          const savings = basePrice - adjustedPrice;
          const isSelected = selectedSlot === slot.id;
          const IconComponent = slot.icon;
          const isAvailable = isSessionAvailable(slot.id);
          const conflictingDates = getConflictingDates(slot.id);
          const isDisabled = disabled || !isAvailable;
          
          return (
            <Label
              key={slot.id}
              htmlFor={slot.id}
              className={cn(
                'flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all',
                isSelected && isAvailable
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : isAvailable
                  ? 'border-border hover:border-primary/50 hover:bg-accent/50'
                  : 'border-red-200 bg-red-50/30',
                isDisabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <RadioGroupItem 
                value={slot.id} 
                id={slot.id}
                disabled={isDisabled}
                className="mt-0.5"
              />
              
              <IconComponent className={cn(
                'h-8 w-8 flex-shrink-0',
                isSelected && isAvailable
                  ? 'text-primary' 
                  : isAvailable 
                  ? 'text-muted-foreground'
                  : 'text-red-400'
              )} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'font-semibold text-base',
                    !isAvailable && 'text-red-600'
                  )}>
                    {slot.label}
                  </span>
                  {slot.popular && isAvailable && (
                    <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5">
                      Most Popular
                    </Badge>
                  )}
                  {slot.savingsText && isAvailable && (
                    <Badge className="bg-green-500 text-white text-xs px-2 py-0.5">
                      {slot.savingsText}
                    </Badge>
                  )}
                  {!isAvailable && (
                    <Badge className="bg-red-500 text-white text-xs px-2 py-0.5">
                      Unavailable
                    </Badge>
                  )}
                </div>
                <p className={cn(
                  'text-sm mb-2',
                  isAvailable ? 'text-muted-foreground' : 'text-red-500'
                )}>
                  {slot.description}
                </p>
                
                {/* Session availability info */}
                {!isAvailable && conflictingDates.length > 0 && (
                  <div className="flex items-center gap-1 mb-2">
                    <AlertCircleIcon className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      Conflicts on: {conflictingDates.map(d => format(d, 'MMM d')).join(', ')}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                <div className={cn(
                  'text-lg font-bold',
                  isAvailable ? 'text-primary' : 'text-red-400'
                )}>
                  ₹{adjustedPrice.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  per day
                </div>
                {savings > 0 && isAvailable && (
                  <div className="text-xs text-green-600 font-medium">
                    Save ₹{savings.toLocaleString()}
                  </div>
                )}
              </div>
            </Label>
          );
        })}
      </RadioGroup>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          {items && items.length > 0 
            ? '📝 Sessions configured by venue owner'
            : '💡 Choose the duration that fits your event and budget'
          }
        </p>
      </div>
    </div>
  );
}

/**
 * UTILITY FUNCTIONS
 */
export function getTimeSlotById(id: string): TimeSlot | null {
  return DEFAULT_TIME_SLOTS.find(slot => slot.id === id) || null;
}

export function getDefaultTimeSlot(): TimeSlot {
  return DEFAULT_TIME_SLOTS.find(slot => slot.id === 'full_day') || DEFAULT_TIME_SLOTS[2];
}

export function getAllTimeSlots(): TimeSlot[] {
  return [...DEFAULT_TIME_SLOTS];
}

/**
 * Convert time slot to backend timestamps for a given date
 */
export function timeSlotToTimestamps(date: Date, timeSlot: TimeSlot): { startTs: Date; endTs: Date } {
  const startTs = new Date(date);
  const endTs = new Date(date);
  
  const [startHour, startMinute] = timeSlot.startTime.split(':').map(Number);
  const [endHour, endMinute] = timeSlot.endTime.split(':').map(Number);
  
  startTs.setHours(startHour, startMinute, 0, 0);
  
  if (endHour === 0 && endMinute === 0) {
    // Full day goes to next day midnight
    endTs.setDate(endTs.getDate() + 1);
    endTs.setHours(0, 0, 0, 0);
  } else if (timeSlot.endTime === '23:59') {
    // Handle 23:59 as end of day
    endTs.setHours(23, 59, 59, 999);
  } else {
    endTs.setHours(endHour, endMinute, 0, 0);
  }
  
  return { startTs, endTs };
}