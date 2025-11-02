/**
 * Time Slot Selector Component
 * 
 * Allows users to select specific time slots instead of full-day bookings.
 * Supports Morning, Afternoon, Evening, and Full Day options.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClockIcon, SunriseIcon, SunIcon, MoonIcon, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  duration: number; // hours
  priceMultiplier: number; // 1.0 = base price, 0.6 = 60% of base price
  description: string;
  icon: React.ComponentType<any>;
  popular?: boolean;
}

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
  },
];

interface TimeSlotSelectorProps {
  value?: string;
  onChange: (slot: TimeSlot) => void;
  basePrice: number;
  className?: string;
  disabled?: boolean;
}

export function TimeSlotSelector({ 
  value, 
  onChange, 
  basePrice, 
  className, 
  disabled = false 
}: TimeSlotSelectorProps) {
  const [selectedSlot, setSelectedSlot] = useState<string>(value || 'full_day');

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
      </div>
      
      <RadioGroup 
        value={selectedSlot} 
        onValueChange={handleSlotChange}
        disabled={disabled}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {TIME_SLOTS.map((slot) => {
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
          🕰️ Choose the duration that fits your event needs
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
 * Get default time slot
 */
export function getDefaultTimeSlot(): TimeSlot {
  return TIME_SLOTS.find(slot => slot.id === 'full_day') || TIME_SLOTS[0];
}