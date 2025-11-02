/**
 * BookingCalendar Component - Enhanced with Perfect Rounded Pills
 * 
 * Visual improvements:
 * - Rounded pill ranges with cohesive start/middle/end styling
 * - Smooth gradient transitions and proper edge handling
 * - Aligned navigation arrows with consistent sizing
 * - Enhanced animations and hover states
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday, 
  isBefore, 
  startOfDay 
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface BookingCalendarProps {
  selectedDates?: Date[];
  onDateSelect?: (dates: Date[]) => void;
  unavailableDates?: Date[];
  isLoading?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function BookingCalendar({ 
  selectedDates = [], 
  onDateSelect, 
  unavailableDates = [], 
  isLoading = false, 
  minDate = startOfDay(new Date()), 
  maxDate, 
  className 
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [isNavigating, setIsNavigating] = useState(false);

  // Generate calendar days with padding
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startWeekday = start.getDay();
    
    // Previous month padding
    const paddingDays: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const paddingDate = new Date(start);
      paddingDate.setDate(start.getDate() - (i + 1));
      paddingDays.push({ date: paddingDate, isCurrentMonth: false });
    }
    
    // Current month days
    const currentMonthDays = days.map(date => ({ date, isCurrentMonth: true }));
    
    // Next month padding (fill to 6 rows = 42 cells)
    const totalCells = paddingDays.length + currentMonthDays.length;
    const remainingCells = 42 - totalCells;
    const nextMonthPadding: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < remainingCells; i++) {
      const paddingDate = new Date(end);
      paddingDate.setDate(end.getDate() + i + 1);
      nextMonthPadding.push({ date: paddingDate, isCurrentMonth: false });
    }
    
    return [...paddingDays, ...currentMonthDays, ...nextMonthPadding];
  }, [currentMonth]);

  // Selection status helpers
  const isSelected = useCallback(
    (date: Date) => selectedDates.some(selectedDate => isSameDay(selectedDate, date)), 
    [selectedDates]
  );
  
  const isUnavailable = useCallback(
    (date: Date) => unavailableDates.some(unavailableDate => isSameDay(unavailableDate, date)), 
    [unavailableDates]
  );
  
  const isDisabled = useCallback((date: Date) => {
    if (isBefore(date, minDate)) return true;
    if (maxDate && date > maxDate) return true;
    return isUnavailable(date);
  }, [minDate, maxDate, isUnavailable]);

  /**
   * Enhanced range position detection for perfect pill styling
   */
  const getRangePosition = useCallback((date: Date) => {
    if (!isSelected(date) || selectedDates.length === 0) return null;
    
    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const first = sortedDates[0];
    const last = sortedDates[sortedDates.length - 1];
    
    // Single selection
    if (sortedDates.length === 1) return 'single';
    
    // Check if this date is selected
    const dateIndex = sortedDates.findIndex(d => isSameDay(d, date));
    if (dateIndex === -1) return null;
    
    // Range positions
    if (dateIndex === 0) return 'start';
    if (dateIndex === sortedDates.length - 1) return 'end';
    return 'middle';
  }, [selectedDates, isSelected]);

  // Navigation handlers with smooth transitions
  const handlePreviousMonth = async () => {
    if (isNavigating || isLoading) return;
    setIsNavigating(true);
    await new Promise(r => setTimeout(r, 150)); // Smooth transition delay
    setCurrentMonth(prev => subMonths(prev, 1));
    setIsNavigating(false);
  };
  
  const handleNextMonth = async () => {
    if (isNavigating || isLoading) return;
    setIsNavigating(true);
    await new Promise(r => setTimeout(r, 150));
    setCurrentMonth(prev => addMonths(prev, 1));
    setIsNavigating(false);
  };

  // Date selection handler
  const handleDateClick = useCallback((date: Date) => {
    if (isDisabled(date) || isLoading) return;
    
    const dateString = date.toDateString();
    const currentSet = new Set(selectedDates.map(d => d.toDateString()));
    
    if (currentSet.has(dateString)) {
      // Remove date
      currentSet.delete(dateString);
    } else {
      // Add date
      currentSet.add(dateString);
    }
    
    const newSelected = Array.from(currentSet)
      .map(s => new Date(s))
      .sort((a, b) => a.getTime() - b.getTime());
    
    onDateSelect?.(newSelected);
  }, [selectedDates, onDateSelect, isDisabled, isLoading]);

  return (
    <div className={cn('w-full max-w-full bg-transparent', className)}>
      {/* Header with aligned navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handlePreviousMonth} 
          disabled={isNavigating || isLoading}
          className="h-8 w-8 p-0 hover:bg-primary/10 rounded-lg transition-all duration-150 hover:scale-105"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h2 className="text-lg font-semibold select-none flex items-center gap-2">
          {format(currentMonth, 'MMMM yyyy')}
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </h2>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleNextMonth} 
          disabled={isNavigating || isLoading}
          className="h-8 w-8 p-0 hover:bg-primary/10 rounded-lg transition-all duration-150 hover:scale-105"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {WEEKDAYS.map(day => (
          <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground select-none">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid with enhanced animations */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMonth.getTime()}
          initial={{ opacity: 0, x: isNavigating ? 20 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isNavigating ? -20 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="grid grid-cols-7 gap-1"
        >
          {calendarDays.map(({ date, isCurrentMonth }, i) => {
            const selected = isSelected(date);
            const disabled = isDisabled(date);
            const today = isToday(date);
            const range = getRangePosition(date);
            const unavailable = isUnavailable(date);
            
            return (
              <motion.button
                key={`${date.getTime()}-${i}`}
                onClick={() => handleDateClick(date)}
                disabled={disabled || isLoading}
                whileHover={!disabled ? { scale: 1.05 } : {}}
                whileTap={!disabled ? { scale: 0.95 } : {}}
                transition={{ duration: 0.15 }}
                className={cn(
                  // Base styles
                  'h-9 sm:h-10 w-full text-sm font-medium transition-all duration-200 relative',
                  'flex items-center justify-center border border-transparent',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
                  
                  // Month visibility
                  isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50',
                  
                  // Today indicator (when not selected)
                  today && !selected && 'ring-1 ring-primary/30 font-bold bg-primary/5',
                  
                  // Hover states
                  !disabled && !selected && 'hover:bg-primary/10 rounded-full hover:scale-105',
                  
                  // Disabled states
                  disabled && 'opacity-30 cursor-not-allowed',
                  
                  // Unavailable dates
                  unavailable && !selected && 'bg-destructive/10 text-destructive/70 line-through rounded-full',
                  
                  // ENHANCED ROUNDED PILL STYLING
                  // Single selection
                  range === 'single' && cn(
                    'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20',
                    pillBase
                  ),
                  
                  // Range start - rounded left, soft right edge
                  range === 'start' && cn(
                    'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground',
                    'ring-2 ring-primary/30 shadow-md',
                    'rounded-l-full rounded-r-md'
                  ),
                  
                  // Range middle - soft background with rounded edges
                  range === 'middle' && cn(
                    'bg-primary/15 text-primary ring-1 ring-primary/20',
                    'rounded-md'
                  ),
                  
                  // Range end - rounded right, soft left edge
                  range === 'end' && cn(
                    'bg-gradient-to-l from-primary to-primary/90 text-primary-foreground',
                    'ring-2 ring-primary/30 shadow-md',
                    'rounded-r-full rounded-l-md'
                  )
                )}
                title={unavailable ? 'Not available' : disabled ? 'Past date' : undefined}
              >
                <span>{format(date, 'd')}</span>
                
                {/* Today dot indicator */}
                {today && !selected && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
      
      {/* Selection info */}
      {selectedDates.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
            {selectedDates.length > 1 && ' • Tap any selected date to remove it'}
          </p>
        </div>
      )}
    </div>
  );
}