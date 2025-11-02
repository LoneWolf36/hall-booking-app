/**
 * Quick Date Shortcuts Component
 * 
 * Provides fast selection for Today, Tomorrow, This Weekend, etc.
 * Makes booking faster for common use cases.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ClockIcon, ZapIcon, HeartIcon } from 'lucide-react';
import { format, addDays, nextSaturday, nextSunday, isToday, isTomorrow, isThisWeekend } from 'date-fns';
import { motion } from 'framer-motion';

interface QuickDateShortcutsProps {
  onDateSelect: (dates: Date[]) => void;
  selectedDates: Date[];
  unavailableDates: Date[];
  className?: string;
}

export function QuickDateShortcuts({ 
  onDateSelect, 
  selectedDates, 
  unavailableDates, 
  className 
}: QuickDateShortcutsProps) {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const nextWeekend = [nextSaturday(today), nextSunday(today)];
  const next3Days = [today, tomorrow, addDays(today, 2)];
  const thisWeek = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const shortcuts = [
    {
      id: 'today',
      label: 'Today',
      subLabel: format(today, 'MMM d'),
      dates: [today],
      icon: ZapIcon,
      variant: 'primary' as const,
    },
    {
      id: 'tomorrow',
      label: 'Tomorrow',
      subLabel: format(tomorrow, 'MMM d'),
      dates: [tomorrow],
      icon: ClockIcon,
      variant: 'secondary' as const,
    },
    {
      id: 'weekend',
      label: 'This Weekend',
      subLabel: `${format(nextWeekend[0], 'MMM d')}-${format(nextWeekend[1], 'd')}`,
      dates: nextWeekend,
      icon: HeartIcon,
      variant: 'outline' as const,
    },
    {
      id: 'next3',
      label: 'Next 3 Days',
      subLabel: `${format(today, 'MMM d')}-${format(addDays(today, 2), 'd')}`,
      dates: next3Days,
      icon: CalendarIcon,
      variant: 'ghost' as const,
    },
  ];

  const isDateUnavailable = (date: Date) => {
    return unavailableDates.some(unavailable => 
      format(unavailable, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  const isShortcutSelected = (shortcutDates: Date[]) => {
    if (selectedDates.length !== shortcutDates.length) return false;
    return shortcutDates.every(date => 
      selectedDates.some(selected => 
        format(selected, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      )
    );
  };

  const isShortcutAvailable = (shortcutDates: Date[]) => {
    return shortcutDates.every(date => !isDateUnavailable(date));
  };

  const handleShortcutClick = (shortcutDates: Date[]) => {
    const availableDates = shortcutDates.filter(date => !isDateUnavailable(date));
    
    if (availableDates.length === 0) {
      // All dates unavailable
      return;
    }
    
    if (availableDates.length !== shortcutDates.length) {
      // Some dates unavailable - use available ones
      onDateSelect(availableDates);
      return;
    }
    
    // All dates available
    onDateSelect(availableDates);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <ZapIcon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Quick Select</span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {shortcuts.map((shortcut, index) => {
          const isSelected = isShortcutSelected(shortcut.dates);
          const isAvailable = isShortcutAvailable(shortcut.dates);
          const availableCount = shortcut.dates.filter(d => !isDateUnavailable(d)).length;
          const IconComponent = shortcut.icon;
          
          return (
            <motion.div
              key={shortcut.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Button
                onClick={() => handleShortcutClick(shortcut.dates)}
                disabled={!isAvailable && availableCount === 0}
                variant={isSelected ? 'default' : shortcut.variant}
                size="sm"
                className={`
                  h-auto p-3 flex flex-col items-center gap-1 text-center w-full
                  transition-all duration-200 hover:scale-105
                  ${isSelected ? 'ring-2 ring-primary/50 shadow-lg' : ''}
                  ${!isAvailable && availableCount === 0 ? 'opacity-40' : ''}
                `}
              >
                <IconComponent className="h-4 w-4" />
                <div className="space-y-1">
                  <div className="text-xs font-semibold">{shortcut.label}</div>
                  <div className="text-[10px] text-muted-foreground">{shortcut.subLabel}</div>
                  
                  {!isAvailable && availableCount > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {availableCount} available
                    </Badge>
                  )}
                  
                  {!isAvailable && availableCount === 0 && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">
                      Unavailable
                    </Badge>
                  )}
                </div>
              </Button>
            </motion.div>
          );
        })}
      </div>
      
      <div className="text-center">
        <p className="text-[11px] text-muted-foreground">
          💡 Quick shortcuts for faster booking
        </p>
      </div>
    </div>
  );
}