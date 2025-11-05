/**
 * Enhanced BookingCalendar Component - Improved UI/UX
 * 
 * MAJOR UX IMPROVEMENTS:
 * - Enhanced visual feedback for date selection with better range styling
 * - Improved accessibility with ARIA labels and keyboard navigation
 * - Better loading states and error handling
 * - Enhanced visual hierarchy and contrast ratios
 * - Responsive design with mobile-optimized touch targets
 * - Smooth animations and micro-interactions
 * - Better unavailable date indicators
 * - Quick selection hints and tooltips
 * - Improved calendar navigation with month/year picker
 */

'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Calendar as CalendarIcon,
  Info,
  X,
  ChevronDown
} from 'lucide-react';
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
  startOfDay,
  addYears,
  subYears,
  setMonth,
  setYear
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

// Weekdays with full names for accessibility
const WEEKDAYS = [
  { short: 'Sun', full: 'Sunday' },
  { short: 'Mon', full: 'Monday' },
  { short: 'Tue', full: 'Tuesday' },
  { short: 'Wed', full: 'Wednesday' },
  { short: 'Thu', full: 'Thursday' },
  { short: 'Fri', full: 'Friday' },
  { short: 'Sat', full: 'Saturday' },
] as const;

interface BookingCalendarProps {
  selectedDates?: Date[];
  onDateSelect?: (dates: Date[]) => void;
  unavailableDates?: Date[];
  isLoading?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  showSelectionInfo?: boolean;
  allowMultiple?: boolean;
  showQuickActions?: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isUnavailable: boolean;
  isDisabled: boolean;
  isToday: boolean;
  rangePosition: 'single' | 'start' | 'middle' | 'end' | null;
}

export function BookingCalendar({ 
  selectedDates = [], 
  onDateSelect, 
  unavailableDates = [], 
  isLoading = false, 
  minDate = startOfDay(new Date()), 
  maxDate, 
  className,
  showSelectionInfo = true,
  allowMultiple = true,
  showQuickActions = true
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [isNavigating, setIsNavigating] = useState(false);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Generate months for picker
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: format(new Date(2024, i), 'MMMM')
    }));
  }, []);

  // Generate years for picker
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => ({
      value: currentYear + i,
      label: String(currentYear + i)
    }));
  }, []);

  // Generate enhanced calendar days with all metadata
  const calendarDays = useMemo((): CalendarDay[] => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startWeekday = start.getDay();
    
    // Helper functions
    const isSelectedFn = (date: Date) => 
      selectedDates.some(selectedDate => isSameDay(selectedDate, date));
    
    const isUnavailableFn = (date: Date) => 
      unavailableDates.some(unavailableDate => isSameDay(unavailableDate, date));
    
    const isDisabledFn = (date: Date) => {
      if (isBefore(date, minDate)) return true;
      if (maxDate && date > maxDate) return true;
      return isUnavailableFn(date);
    };
    
    const getRangePositionFn = (date: Date) => {
      if (!isSelectedFn(date) || selectedDates.length === 0) return null;
      
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      
      if (sortedDates.length === 1) return 'single';
      
      const dateIndex = sortedDates.findIndex(d => isSameDay(d, date));
      if (dateIndex === -1) return null;
      
      if (dateIndex === 0) return 'start';
      if (dateIndex === sortedDates.length - 1) return 'end';
      return 'middle';
    };
    
    // Previous month padding
    const paddingDays: CalendarDay[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const paddingDate = new Date(start);
      paddingDate.setDate(start.getDate() - (i + 1));
      paddingDays.push({
        date: paddingDate,
        isCurrentMonth: false,
        isSelected: false,
        isUnavailable: false,
        isDisabled: true,
        isToday: false,
        rangePosition: null,
      });
    }
    
    // Current month days with full metadata
    const currentMonthDays: CalendarDay[] = days.map(date => ({
      date,
      isCurrentMonth: true,
      isSelected: isSelectedFn(date),
      isUnavailable: isUnavailableFn(date),
      isDisabled: isDisabledFn(date),
      isToday: isToday(date),
      rangePosition: getRangePositionFn(date),
    }));
    
    // Next month padding
    const totalCells = paddingDays.length + currentMonthDays.length;
    const remainingCells = 42 - totalCells;
    const nextMonthPadding: CalendarDay[] = [];
    for (let i = 0; i < remainingCells; i++) {
      const paddingDate = new Date(end);
      paddingDate.setDate(end.getDate() + i + 1);
      nextMonthPadding.push({
        date: paddingDate,
        isCurrentMonth: false,
        isSelected: false,
        isUnavailable: false,
        isDisabled: true,
        isToday: false,
        rangePosition: null,
      });
    }
    
    return [...paddingDays, ...currentMonthDays, ...nextMonthPadding];
  }, [currentMonth, selectedDates, unavailableDates, minDate, maxDate]);

  // Enhanced navigation handlers
  const handlePreviousMonth = useCallback(async () => {
    if (isNavigating || isLoading) return;
    setIsNavigating(true);
    await new Promise(r => setTimeout(r, 150));
    setCurrentMonth(prev => subMonths(prev, 1));
    setIsNavigating(false);
  }, [isNavigating, isLoading]);
  
  const handleNextMonth = useCallback(async () => {
    if (isNavigating || isLoading) return;
    setIsNavigating(true);
    await new Promise(r => setTimeout(r, 150));
    setCurrentMonth(prev => addMonths(prev, 1));
    setIsNavigating(false);
  }, [isNavigating, isLoading]);

  // Enhanced date selection with better UX
  const handleDateClick = useCallback((date: Date, dayData: CalendarDay) => {
    if (dayData.isDisabled || isLoading || !dayData.isCurrentMonth) return;
    
    let newSelected: Date[];
    
    if (allowMultiple) {
      const dateString = date.toDateString();
      const currentSet = new Set(selectedDates.map(d => d.toDateString()));
      
      if (currentSet.has(dateString)) {
        // Remove date
        currentSet.delete(dateString);
      } else {
        // Add date
        currentSet.add(dateString);
      }
      
      newSelected = Array.from(currentSet)
        .map(s => new Date(s))
        .sort((a, b) => a.getTime() - b.getTime());
    } else {
      // Single selection mode
      newSelected = dayData.isSelected ? [] : [date];
    }
    
    onDateSelect?.(newSelected);
  }, [selectedDates, onDateSelect, isLoading, allowMultiple]);

  // Quick actions
  const handleClearSelection = useCallback(() => {
    onDateSelect?.([]);
  }, [onDateSelect]);

  const handleSelectWeekend = useCallback(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    const weekends = days.filter(date => {
      const day = date.getDay();
      return (day === 0 || day === 6) && !unavailableDates.some(ud => isSameDay(ud, date));
    });
    
    onDateSelect?.(weekends);
  }, [currentMonth, unavailableDates, onDateSelect]);

  // Month/Year picker handlers
  const handleMonthChange = (month: string) => {
    setCurrentMonth(prev => setMonth(prev, parseInt(month)));
    setShowMonthYearPicker(false);
  };

  const handleYearChange = (year: string) => {
    setCurrentMonth(prev => setYear(prev, parseInt(year)));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!calendarRef.current?.contains(document.activeElement)) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousMonth();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextMonth();
          break;
        case 'Escape':
          setShowMonthYearPicker(false);
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePreviousMonth, handleNextMonth]);

  const selectionStats = useMemo(() => {
    const totalDays = selectedDates.length;
    const weekends = selectedDates.filter(date => {
      const day = date.getDay();
      return day === 0 || day === 6;
    }).length;
    const weekdays = totalDays - weekends;
    
    return { totalDays, weekends, weekdays };
  }, [selectedDates]);

  return (
    <TooltipProvider delayDuration={500}>
      <div 
        ref={calendarRef}
        className={cn('w-full max-w-full bg-transparent', className)}
        role="application"
        aria-label="Event booking calendar"
      >
        {/* Enhanced Header with Month/Year Picker */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handlePreviousMonth} 
            disabled={isNavigating || isLoading}
            className="h-9 w-9 p-0 hover:bg-primary/10 rounded-lg transition-all duration-150 hover:scale-105 shrink-0"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover open={showMonthYearPicker} onOpenChange={setShowMonthYearPicker}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                className="text-lg font-semibold hover:bg-primary/10 rounded-lg px-4 py-2 flex items-center gap-2"
                aria-label="Select month and year"
              >
                {format(currentMonth, 'MMMM yyyy')}
                <ChevronDown className="h-4 w-4" />
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 space-y-4" align="center">
              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Select 
                  value={String(currentMonth.getMonth())} 
                  onValueChange={handleMonthChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select 
                  value={String(currentMonth.getFullYear())} 
                  onValueChange={handleYearChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year.value} value={String(year.value)}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleNextMonth} 
            disabled={isNavigating || isLoading}
            className="h-9 w-9 p-0 hover:bg-primary/10 rounded-lg transition-all duration-150 hover:scale-105 shrink-0"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick Actions */}
        {showQuickActions && selectedDates.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearSelection}
              className="h-7 px-3 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectWeekend}
              className="h-7 px-3 text-xs"
            >
              <CalendarIcon className="h-3 w-3 mr-1" />
              Weekends
            </Button>
          </div>
        )}

        {/* Weekday headers with improved accessibility */}
        <div className="grid grid-cols-7 gap-1 mb-3" role="row">
          {WEEKDAYS.map(day => (
            <div 
              key={day.short} 
              className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground select-none"
              role="columnheader"
              aria-label={day.full}
            >
              {day.short}
            </div>
          ))}
        </div>

        {/* Enhanced Calendar grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMonth.getTime()}
            initial={{ opacity: 0, x: isNavigating ? 20 : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isNavigating ? -20 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="grid grid-cols-7 gap-1"
            role="grid"
            aria-label={`Calendar for ${format(currentMonth, 'MMMM yyyy')}`}
          >
            {calendarDays.map((dayData, i) => {
              const ariaLabel = `${format(dayData.date, 'EEEE, MMMM d, yyyy')}${
                dayData.isSelected ? ', selected' : ''
              }${dayData.isUnavailable ? ', unavailable' : ''}${dayData.isToday ? ', today' : ''}`;
              
              return (
                <Tooltip key={`${dayData.date.getTime()}-${i}`}>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => handleDateClick(dayData.date, dayData)}
                      disabled={dayData.isDisabled || isLoading || !dayData.isCurrentMonth}
                      whileHover={!dayData.isDisabled && dayData.isCurrentMonth ? { scale: 1.05 } : {}}
                      whileTap={!dayData.isDisabled && dayData.isCurrentMonth ? { scale: 0.95 } : {}}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        // Base styles with improved touch targets
                        'h-10 sm:h-11 w-full text-sm font-medium transition-all duration-200 relative',
                        'flex items-center justify-center border border-transparent rounded-lg',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
                        
                        // Month visibility with better contrast
                        dayData.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40',
                        
                        // Today indicator with enhanced styling
                        dayData.isToday && !dayData.isSelected && 'ring-2 ring-primary/40 font-bold bg-primary/5 text-primary',
                        
                        // Improved hover states
                        !dayData.isDisabled && !dayData.isSelected && dayData.isCurrentMonth && 'hover:bg-primary/15 hover:text-primary hover:scale-105',
                        
                        // Better disabled states
                        dayData.isDisabled && 'opacity-20 cursor-not-allowed',
                        !dayData.isCurrentMonth && 'cursor-default',
                        
                        // Enhanced unavailable styling
                        dayData.isUnavailable && !dayData.isSelected && dayData.isCurrentMonth && 'bg-destructive/10 text-destructive/80 relative overflow-hidden',
                        
                        // ENHANCED SELECTION STYLING with better visual hierarchy
                        dayData.rangePosition === 'single' && cn(
                          'bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30',
                          'rounded-full font-semibold'
                        ),
                        
                        dayData.rangePosition === 'start' && cn(
                          'bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground',
                          'ring-2 ring-primary/40 shadow-lg font-semibold',
                          'rounded-l-full rounded-r-lg'
                        ),
                        
                        dayData.rangePosition === 'middle' && cn(
                          'bg-primary/20 text-primary ring-1 ring-primary/30 font-medium',
                          'rounded-lg backdrop-blur-sm'
                        ),
                        
                        dayData.rangePosition === 'end' && cn(
                          'bg-gradient-to-l from-primary via-primary to-primary/80 text-primary-foreground',
                          'ring-2 ring-primary/40 shadow-lg font-semibold',
                          'rounded-r-full rounded-l-lg'
                        )
                      )}
                      aria-label={ariaLabel}
                      role="gridcell"
                      aria-selected={dayData.isSelected}
                      aria-disabled={dayData.isDisabled}
                    >
                      <span className="relative z-10">{format(dayData.date, 'd')}</span>
                      
                      {/* Enhanced unavailable indicator */}
                      {dayData.isUnavailable && dayData.isCurrentMonth && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-px w-full bg-destructive/60 transform rotate-45" />
                        </div>
                      )}
                      
                      {/* Today dot indicator */}
                      {dayData.isToday && !dayData.isSelected && (
                        <motion.div 
                          className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        </motion.div>
                      )}
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="text-center">
                      <div className="font-medium">{format(dayData.date, 'EEEE, MMM d')}</div>
                      {dayData.isToday && <div className="text-primary text-xs">Today</div>}
                      {dayData.isUnavailable && <div className="text-destructive text-xs">Unavailable</div>}
                      {dayData.isSelected && <div className="text-primary text-xs">Selected</div>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </motion.div>
        </AnimatePresence>
        
        {/* Enhanced selection info with statistics */}
        {showSelectionInfo && selectedDates.length > 0 && (
          <motion.div 
            className="mt-6 space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs font-medium">
                <CalendarIcon className="h-3 w-3 mr-1" />
                {selectionStats.totalDays} day{selectionStats.totalDays !== 1 ? 's' : ''} selected
              </Badge>
              
              {selectionStats.weekdays > 0 && (
                <Badge variant="outline" className="text-xs">
                  {selectionStats.weekdays} weekday{selectionStats.weekdays !== 1 ? 's' : ''}
                </Badge>
              )}
              
              {selectionStats.weekends > 0 && (
                <Badge variant="outline" className="text-xs">
                  {selectionStats.weekends} weekend{selectionStats.weekends !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            {allowMultiple && (
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>Tap selected dates to remove • Use quick actions above</span>
              </div>
            )}
          </motion.div>
        )}
        
        {/* Legend for better UX */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-destructive/60 relative">
              <div className="absolute inset-0 bg-destructive/20 transform rotate-45" />
            </div>
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full ring-1 ring-primary/40" />
            <span>Today</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}