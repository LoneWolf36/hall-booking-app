/**
 * BookingCalendar Component (polished)
 * - Rounded pill range with soft gradient for cohesion
 * - Start/End use semi-bold outline instead of solid fill
 * - Middle range uses subtle gradient
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

export function BookingCalendar({ selectedDates = [], onDateSelect, unavailableDates = [], isLoading = false, minDate = startOfDay(new Date()), maxDate, className, }: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [isNavigating, setIsNavigating] = useState(false);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startWeekday = start.getDay();
    const paddingDays: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const paddingDate = new Date(start);
      paddingDate.setDate(start.getDate() - (i + 1));
      paddingDays.push({ date: paddingDate, isCurrentMonth: false });
    }
    const currentMonthDays = days.map(date => ({ date, isCurrentMonth: true }));
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

  const isSelected = useCallback((date: Date) => selectedDates.some(selectedDate => isSameDay(selectedDate, date)), [selectedDates]);
  const isUnavailable = useCallback((date: Date) => unavailableDates.some(unavailableDate => isSameDay(unavailableDate, date)), [unavailableDates]);
  const isDisabled = useCallback((date: Date) => { if (isBefore(date, minDate)) return true; if (maxDate && date > maxDate) return true; return isUnavailable(date); }, [minDate, maxDate, isUnavailable]);

  const getRangePosition = useCallback((date: Date) => {
    if (!isSelected(date) || selectedDates.length === 0) return null;
    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const first = sortedDates[0];
    const last = sortedDates[sortedDates.length - 1];
    if (isSameDay(date, first) && isSameDay(date, last)) return 'single';
    if (isSameDay(date, first)) return 'start';
    if (isSameDay(date, last)) return 'end';
    if (sortedDates.some(d => isSameDay(d, date))) return 'middle';
    return null;
  }, [selectedDates, isSelected]);

  const handlePreviousMonth = async () => { setIsNavigating(true); await new Promise(r => setTimeout(r, 120)); setCurrentMonth(prev => subMonths(prev, 1)); setIsNavigating(false); };
  const handleNextMonth = async () => { setIsNavigating(true); await new Promise(r => setTimeout(r, 120)); setCurrentMonth(prev => addMonths(prev, 1)); setIsNavigating(false); };

  const handleDateClick = useCallback((date: Date) => { if (isDisabled(date) || isLoading) return; const set = new Set(selectedDates.map(d => d.toDateString())); if (set.has(date.toDateString())) set.delete(date.toDateString()); else set.add(date.toDateString()); const newSelected = Array.from(set).map(s => new Date(s)).sort((a,b)=>a.getTime()-b.getTime()); onDateSelect?.(newSelected); }, [selectedDates, onDateSelect, isDisabled, isLoading]);

  return (
    <div className={cn('w-full max-w-full bg-transparent', className)}>
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" onClick={handlePreviousMonth} disabled={isNavigating || isLoading} className="h-8 w-8 p-0 hover:bg-primary/10 rounded-lg"><ChevronLeft className="h-4 w-4"/></Button>
        <h2 className="text-lg font-semibold select-none flex items-center gap-2">{format(currentMonth, 'MMMM yyyy')}{isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>}</h2>
        <Button variant="ghost" size="sm" onClick={handleNextMonth} disabled={isNavigating || isLoading} className="h-8 w-8 p-0 hover:bg-primary/10 rounded-lg"><ChevronRight className="h-4 w-4"/></Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground select-none">{d}</div>)}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentMonth.getTime()} initial={{opacity:0,x:isNavigating?20:0}} animate={{opacity:1,x:0}} exit={{opacity:0,x:isNavigating?-20:0}} transition={{duration:0.15}} className="grid grid-cols-7 gap-1">
          {calendarDays.map(({date,isCurrentMonth},i)=>{
            const selected = isSelected(date);
            const disabled = isDisabled(date);
            const today = isToday(date);
            const range = getRangePosition(date);
            const unavailable = isUnavailable(date);
            
            // rounded pill classes
            const pillBase = 'rounded-full';
            const middleBg = 'bg-primary/15 text-primary';
            const edgeOutline = 'ring-2 ring-primary bg-gradient-to-b from-primary/20 to-primary/30 text-primary-foreground';
            const singleBg = 'bg-primary text-primary-foreground';

            return (
              <motion.button key={`${date.getTime()}-${i}`} onClick={()=>handleDateClick(date)} disabled={disabled||isLoading} whileHover={!disabled?{scale:1.05}:{}} whileTap={!disabled?{scale:0.95}:{}} className={cn('h-9 sm:h-10 w-full text-sm font-medium transition-all duration-200 relative flex items-center justify-center border border-transparent', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50', isCurrentMonth? 'text-foreground':'text-muted-foreground/50', today && !selected && 'ring-1 ring-accent/50 font-bold', !disabled && !selected && 'hover:bg-primary/10 rounded-full', disabled && 'opacity-30 cursor-not-allowed', unavailable && !selected && 'bg-destructive/10 text-destructive line-through rounded-full', range==='single' && cn(singleBg,pillBase,'shadow-sm'), range==='start' && cn(edgeOutline,pillBase,'rounded-l-full rounded-r-2xl'), range==='middle' && cn(middleBg,'rounded-none','rounded-l-2xl rounded-r-2xl'), range==='end' && cn(edgeOutline,pillBase,'rounded-r-full rounded-l-2xl'))} title={unavailable ? 'Not available' : disabled ? 'Past date' : undefined}>
                <span>{format(date,'d')}</span>
              </motion.button>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
