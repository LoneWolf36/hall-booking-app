/**
 * Step Navigation Component
 * 
 * Provides Back/Next navigation buttons for multi-step booking flow.
 * Integrates with booking store for step management.
 */

'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { useBookingStore } from '@/stores';

export interface StepNavigationProps {
  onNext?: () => void | Promise<void>;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  showBack?: boolean;
  showNext?: boolean;
  isNextLoading?: boolean;
  className?: string;
}

/**
 * Step navigation component with back/next buttons
 */
export function StepNavigation({
  onNext,
  onBack,
  nextLabel = 'Next',
  backLabel = 'Back',
  nextDisabled = false,
  backDisabled = false,
  showBack = true,
  showNext = true,
  isNextLoading = false,
  className,
}: StepNavigationProps) {
  const { goToPreviousStep, goToNextStep } = useBookingStore();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goToPreviousStep();
    }
  };

  const handleNext = async () => {
    if (onNext) {
      await onNext();
    } else {
      goToNextStep();
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        {showBack && (
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={backDisabled}
            className="min-w-[120px]"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        )}

        <div className="flex-1" />

        {showNext && (
          <Button
            onClick={handleNext}
            disabled={nextDisabled}
            isLoading={isNextLoading}
            className="min-w-[120px]"
          >
            {nextLabel}
            {!isNextLoading && <ArrowRightIcon className="ml-2 h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Floating navigation for mobile
 */
export function FloatingStepNavigation(props: StepNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-50 md:hidden">
      <StepNavigation {...props} />
    </div>
  );
}

/**
 * Summary navigation with count
 */
export interface SummaryNavigationProps extends StepNavigationProps {
  itemCount?: number;
  itemLabel?: string;
}

export function SummaryNavigation({
  itemCount,
  itemLabel = 'items',
  ...props
}: SummaryNavigationProps) {
  return (
    <div className="border-t pt-4">
      {itemCount !== undefined && (
        <div className="text-sm text-muted-foreground mb-4">
          {itemCount} {itemLabel} selected
        </div>
      )}
      <StepNavigation {...props} />
    </div>
  );
}
