/**
 * BookingCalendar Component
 * 
 * Custom calendar optimized for multi-day booking selection with:
 * - Proper responsive design for booking flow
 * - Range selection with visual feedback
 * - Loading states during availability checks
 * - Smooth animations and transitions
 * - Touch-friendly interaction on mobile
 * - Proper unavailable date indication
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
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

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function BookingCalendar({
  selectedDates = [],
  onDateSelect,
  unavailableDates = [],
  isLoading = false,
  minDate = startOfDay(new Date()),
  maxDate,
  className,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [isNavigating, setIsNavigating] = useState(false);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding days from previous month to fill first week
    const startWeekday = start.getDay();
    const paddingDays = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const paddingDate = new Date(start);
      paddingDate.setDate(start.getDate() - (i + 1));
      paddingDays.push({ date: paddingDate, isCurrentMonth: false });
    }
    
    // Add current month days
    const currentMonthDays = days.map(date => ({ date, isCurrentMonth: true }));
    
    // Add padding days from next month to fill last week
    const totalCells = paddingDays.length + currentMonthDays.length;
    const remainingCells = 42 - totalCells; // 6 weeks * 7 days
    const nextMonthPadding = [];
    for (let i = 0; i < remainingCells; i++) {
      const paddingDate = new Date(end);
      paddingDate.setDate(end.getDate() + i + 1);
      nextMonthPadding.push({ date: paddingDate, isCurrentMonth: false });
    }
    
    return [...paddingDays, ...currentMonthDays, ...nextMonthPadding];
  }, [currentMonth]);

  // Date state helpers
  const isSelected = useCallback((date: Date) => {
    return selectedDates.some(selectedDate => isSameDay(selectedDate, date));
  }, [selectedDates]);

  const isUnavailable = useCallback((date: Date) => {
    return unavailableDates.some(unavailableDate => isSameDay(unavailableDate, date));
  }, [unavailableDates]);

  const isDisabled = useCallback((date: Date) => {
    if (isBefore(date, minDate)) return true;
    if (maxDate && date > maxDate) return true;
    return isUnavailable(date);
  }, [minDate, maxDate, isUnavailable]);

  // Range styling helpers
  const getRangePosition = useCallback((date: Date) => {
    if (!isSelected(date) || selectedDates.length <= 1) return null;
    
    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const dateIndex = sortedDates.findIndex(d => isSameDay(d, date));
    
    if (dateIndex === 0 && sortedDates.length > 1) return 'start';
    if (dateIndex === sortedDates.length - 1 && sortedDates.length > 1) return 'end';
    if (dateIndex > 0) return 'middle';
    return 'single';
  }, [selectedDates, isSelected]);

  // Navigation handlers
  const handlePreviousMonth = async () => {
    setIsNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 150)); // Smooth transition
    setCurrentMonth(prev => subMonths(prev, 1));
    setIsNavigating(false);
  };

  const handleNextMonth = async () => {
    setIsNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 150)); // Smooth transition
    setCurrentMonth(prev => addMonths(prev, 1));
    setIsNavigating(false);
  };

  // Date selection handler
  const handleDateClick = useCallback((date: Date) => {
    if (isDisabled(date) || isLoading) return;
    
    const newSelectedDates = isSelected(date)
      ? selectedDates.filter(d => !isSameDay(d, date))
      : [...selectedDates, date].sort((a, b) => a.getTime() - b.getTime());
    
    onDateSelect?.(newSelectedDates);
  }, [selectedDates, onDateSelect, isSelected, isDisabled, isLoading]);

  return (
    <div className={cn('w-full max-w-full bg-card rounded-xl border shadow-sm', className)}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePreviousMonth}
          disabled={isNavigating || isLoading}
          className="h-8 w-8 p-0 hover:bg-primary/10 transition-all rounded-lg"
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
          className="h-8 w-8 p-0 hover:bg-primary/10 transition-all rounded-lg"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground select-none">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMonth.getTime()}
            initial={{ opacity: 0, x: isNavigating ? (currentMonth > new Date() ? 20 : -20) : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isNavigating ? (currentMonth > new Date() ? -20 : 20) : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="grid grid-cols-7 gap-1"
          >
            {calendarDays.map(({ date, isCurrentMonth }, index) => {
              const selected = isSelected(date);
              const disabled = isDisabled(date);
              const today = isToday(date);
              const rangePosition = getRangePosition(date);
              const unavailable = isUnavailable(date);

              return (
                <motion.button
                  key={`${date.getTime()}-${index}`}
                  onClick={() => handleDateClick(date)}
                  disabled={disabled || isLoading}
                  whileHover={!disabled ? { scale: 1.05 } : {}}
                  whileTap={!disabled ? { scale: 0.95 } : {}}
                  className={cn(
                    // Base styles
                    'h-8 sm:h-9 w-full rounded-lg text-sm font-medium transition-all duration-200 relative',
                    'flex items-center justify-center border border-transparent',
                    'hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    
                    // Current month vs padding
                    isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50',
                    
                    // Today styling
                    today && !selected && 'bg-accent/40 text-accent-foreground ring-1 ring-accent/50 font-bold',
                    
                    // Selection states
                    selected && rangePosition === 'single' && 'bg-primary text-primary-foreground scale-110 shadow-sm',
                    selected && rangePosition === 'start' && 'bg-primary text-primary-foreground rounded-r-sm',
                    selected && rangePosition === 'middle' && 'bg-primary/20 text-primary rounded-none',
                    selected && rangePosition === 'end' && 'bg-primary text-primary-foreground rounded-l-sm',
                    
                    // Disabled states
                    disabled && 'opacity-30 cursor-not-allowed',
                    unavailable && !selected && 'bg-destructive/10 text-destructive line-through',
                    
                    // Interactive states
                    !disabled && !selected && 'hover:bg-primary/10',
                    
                    // Loading state
                    isLoading && 'pointer-events-none'
                  )}
                  title={unavailable ? 'Not available' : disabled ? 'Past date' : undefined}
                >
                  <span>{format(date, 'd')}</span>
                  
                  {/* Selection indicator */}
                  {selected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary shadow-sm"
                    />
                  )}
                  
                  {/* Today indicator */}
                  {today && !selected && (
                    <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 h-1 w-1 rounded-full bg-current" />
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Selection Summary */}
      {selectedDates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="border-t p-4 bg-muted/20"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDateSelect?.([])}
              className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}