/**
 * Booking Progress Indicator
 * 
 * Shows current booking flow progress with step names.
 * Integrates with booking store to display real-time progress.
 */

'use client';

import { useMemo } from 'react';
import { useBookingStore, type BookingStep } from '@/stores';
import { Stepper, type Step } from '@/components/ui/stepper';

/**
 * Step definitions for booking flow
 */
const BOOKING_STEPS: Record<BookingStep, Step> = {
  venue_selection: {
    id: 'venue_selection',
    label: 'Date',
    description: 'Select dates',
  },
  event_details: {
    id: 'event_details',
    label: 'Details',
    description: 'Event info',
  },
  addons: {
    id: 'addons',
    label: 'Add-ons',
    description: 'Optional',
  },
  payment_method: {
    id: 'payment_method',
    label: 'Payment',
    description: 'Method',
  },
  auth: {
    id: 'auth',
    label: 'Login',
    description: 'Verify',
  },
  confirmation: {
    id: 'confirmation',
    label: 'Review',
    description: 'Confirm',
  },
  processing: {
    id: 'processing',
    label: 'Processing',
    description: 'Payment',
  },
  success: {
    id: 'success',
    label: 'Done',
    description: 'Complete',
  },
};

const STEP_ORDER: BookingStep[] = [
  'venue_selection',
  'event_details',
  'addons',
  'payment_method',
  'auth',
  'confirmation',
  'processing',
  'success',
];

export interface BookingProgressProps {
  variant?: 'horizontal' | 'vertical';
  className?: string;
  showDescriptions?: boolean;
}

/**
 * Booking progress indicator component
 */
export function BookingProgress({
  variant = 'horizontal',
  className,
  showDescriptions = true,
}: BookingProgressProps) {
  const { currentStep, completedSteps } = useBookingStore();

  const steps = useMemo(() => {
    return STEP_ORDER.map((stepId) => ({
      ...BOOKING_STEPS[stepId],
      description: showDescriptions ? BOOKING_STEPS[stepId].description : undefined,
    }));
  }, [showDescriptions]);

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const completedStepIndexes = completedSteps.map((step) => STEP_ORDER.indexOf(step));

  return (
    <Stepper
      steps={steps}
      currentStep={currentStepIndex}
      completedSteps={completedStepIndexes}
      variant={variant}
      className={className}
    />
  );
}

/**
 * Compact progress bar for mobile
 */
export function CompactBookingProgress({ className }: { className?: string }) {
  const { currentStep } = useBookingStore();
  
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const totalSteps = STEP_ORDER.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {BOOKING_STEPS[currentStep].label}
        </span>
        <span className="text-xs text-muted-foreground">
          {currentStepIndex + 1}/{totalSteps}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
