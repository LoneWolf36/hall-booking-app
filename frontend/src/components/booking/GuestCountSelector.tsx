/**
 * Guest Count Selector Component
 * 
 * Interactive input for selecting guest count with increment/decrement buttons.
 * Includes slider for quick selection of larger numbers.
 */

'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MinusIcon, PlusIcon, UsersIcon } from 'lucide-react';

export interface GuestCountSelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  className?: string;
  showSlider?: boolean;
}

/**
 * Guest count selector with increment/decrement controls
 */
export function GuestCountSelector({
  value,
  onChange,
  min = 1,
  max = 1000,
  step = 1,
  error,
  className,
  showSlider = true,
}: GuestCountSelectorProps) {
  const handleIncrement = () => {
    if (value < max) {
      onChange(Math.min(value + step, max));
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(Math.max(value - step, min));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onChange(Math.max(min, Math.min(max, newValue)));
    } else if (e.target.value === '') {
      onChange(min);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Increment/Decrement Controls */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label="Decrease guest count"
        >
          <MinusIcon className="h-4 w-4" />
        </Button>

        <div className="relative flex-1 max-w-[200px]">
          <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            className={cn('text-center font-semibold text-lg pl-10 pr-4', {
              'border-destructive': error,
            })}
            aria-label="Guest count"
            aria-invalid={!!error}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label="Increase guest count"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Range Slider (optional) */}
      {showSlider && (
        <div className="space-y-2">
          <input
            type="range"
            value={value}
            onChange={handleSliderChange}
            min={min}
            max={max}
            step={step}
            className={cn(
              'w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer',
              'range-slider'
            )}
            aria-label="Guest count slider"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{min}</span>
            <span className="font-medium text-foreground">{value} guests</span>
            <span>{max}</span>
          </div>
        </div>
      )}

      {/* Quick Select Buttons */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground self-center">Quick select:</span>
        {[50, 100, 200, 500].map((count) => {
          if (count <= max) {
            return (
              <Button
                key={count}
                type="button"
                variant={value === count ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChange(count)}
                className="text-xs"
              >
                {count}
              </Button>
            );
          }
          return null;
        })}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Capacity warning */}
      {value > max * 0.9 && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⚠️ Approaching venue capacity
        </p>
      )}
    </div>
  );
}

/**
 * Compact guest count display (read-only)
 */
export interface GuestCountDisplayProps {
  count: number;
  className?: string;
}

export function GuestCountDisplay({ count, className }: GuestCountDisplayProps) {
  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <UsersIcon className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{count.toLocaleString()} guests</span>
    </div>
  );
}
