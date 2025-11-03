/**
 * Time Slot Selector - SIMPLIFIED VERSION
 * 
 * Removed all overengineering. Simple, intuitive options that everyone understands.
 * No complex venue detection, no backend configuration - just clear choices.
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClockIcon, SunIcon, MoonIcon, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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

// SIMPLIFIED: Only 3 clear options everyone understands
const TIME_SLOTS: TimeSlot[] = [
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
  value?: string;
  onChange: (slot: TimeSlot) => void;
  basePrice: number;
  className?: string;
  disabled?: boolean;
  items?: TimeSlot[]; // Optional custom slots
}

export function TimeSlotSelector({ 
  value, 
  onChange, 
  basePrice, 
  className, 
  disabled = false,
  items // Custom slots
}: TimeSlotSelectorProps) {
  const [selectedSlot, setSelectedSlot] = useState<string>(value || 'full_day');

  // Use custom slots if provided, otherwise fallback to hardcoded TIME_SLOTS
  const slotOptions = items && items.length > 0 ? items : TIME_SLOTS;

  const handleSlotChange = (slotId: string) => {
    // Look up slot in custom slots if provided, otherwise fallback to TIME_SLOTS
    const slot = slotOptions.find(s => s.id === slotId);
    if (slot) {
      setSelectedSlot(slotId);
      onChange(slot);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <ClockIcon className="h-4 w-4 text-primary" />
        <Label className="text-base font-medium">Choose Your Booking Duration</Label>
      </div>
      
      <RadioGroup 
        value={selectedSlot} 
        onValueChange={handleSlotChange}
        disabled={disabled}
        className="space-y-3"
      >
        {slotOptions.map((slot) => {
          const adjustedPrice = Math.round(basePrice * slot.priceMultiplier);
          const savings = basePrice - adjustedPrice;
          const isSelected = selectedSlot === slot.id;
          const IconComponent = slot.icon;
          
          return (
            <Label
              key={slot.id}
              htmlFor={slot.id}
              className={cn(
                'flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all',
                isSelected 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : 'border-border hover:border-primary/50 hover:bg-accent/50',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <RadioGroupItem 
                value={slot.id} 
                id={slot.id}
                disabled={disabled}
                className="mt-0.5"
              />
              
              <IconComponent className={cn(
                'h-8 w-8 flex-shrink-0',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-base">{slot.label}</span>
                  {slot.popular && (
                    <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5">
                      Most Popular
                    </Badge>
                  )}
                  {slot.savingsText && (
                    <Badge className="bg-green-500 text-white text-xs px-2 py-0.5">
                      {slot.savingsText}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {slot.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                <div className="text-lg font-bold text-primary">
                  ₹{adjustedPrice.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  per day
                </div>
                {savings > 0 && (
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
          💡 Choose the duration that fits your event and budget
        </p>
      </div>
    </div>
  );
}

/**
 * SIMPLIFIED UTILITIES - No overengineering
 */
export function getTimeSlotById(id: string): TimeSlot | null {
  return TIME_SLOTS.find(slot => slot.id === id) || null;
}

export function getDefaultTimeSlot(): TimeSlot {
  return TIME_SLOTS.find(slot => slot.id === 'full_day') || TIME_SLOTS[2];
}

export function getAllTimeSlots(): TimeSlot[] {
  return [...TIME_SLOTS];
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
  } else {
    endTs.setHours(endHour, endMinute, 0, 0);
  }
  
  return { startTs, endTs };
}