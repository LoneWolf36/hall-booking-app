/**
 * Stepper Component
 * 
 * Visual progress indicator for multi-step booking flow.
 * Shows current step, completed steps, and upcoming steps.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: Step[];
  currentStep: number;
  completedSteps?: number[];
  className?: string;
  variant?: 'horizontal' | 'vertical';
}

/**
 * Stepper component for displaying multi-step progress
 */
export function Stepper({
  steps,
  currentStep,
  completedSteps = [],
  className,
  variant = 'horizontal',
}: StepperProps) {
  const isStepCompleted = (index: number) => completedSteps.includes(index);
  const isStepCurrent = (index: number) => index === currentStep;
  const isStepUpcoming = (index: number) => index > currentStep;

  if (variant === 'vertical') {
    return (
      <div className={cn('space-y-4', className)}>
        {steps.map((step, index) => {
          const completed = isStepCompleted(index);
          const current = isStepCurrent(index);
          const upcoming = isStepUpcoming(index);

          return (
            <div key={step.id} className="flex gap-3">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                    {
                      'border-primary bg-primary text-primary-foreground': completed,
                      'border-primary bg-background text-primary': current,
                      'border-muted bg-background text-muted-foreground': upcoming,
                    }
                  )}
                >
                  {completed ? (
                    <CheckIcon className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn('w-0.5 flex-1 my-2 min-h-[2rem]', {
                      'bg-primary': completed,
                      'bg-muted': !completed,
                    })}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-8">
                <h3
                  className={cn('font-medium', {
                    'text-foreground': current || completed,
                    'text-muted-foreground': upcoming,
                  })}
                >
                  {step.label}
                </h3>
                {step.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('w-full overflow-x-auto hide-scrollbar smooth-scroll pb-1', className)}>
      <div className="flex items-center justify-between min-w-max px-1">
        {steps.map((step, index) => {
          const completed = isStepCompleted(index);
          const current = isStepCurrent(index);
          const upcoming = isStepUpcoming(index);
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1 min-w-[60px] sm:min-w-[80px]">
                {/* Step indicator */}
                <div
                  className={cn(
                    'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-colors',
                    {
                      'border-primary bg-primary text-primary-foreground': completed,
                      'border-primary bg-background text-primary': current,
                      'border-muted bg-background text-muted-foreground': upcoming,
                    }
                  )}
                >
                  {completed ? (
                    <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <span className="text-xs sm:text-sm font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Step label */}
                <div className="mt-1 sm:mt-2 text-center px-1">
                  <p
                    className={cn('text-xs sm:text-sm font-medium truncate max-w-[60px] sm:max-w-none', {
                      'text-foreground': current || completed,
                      'text-muted-foreground': upcoming,
                    })}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn('h-0.5 flex-1 mx-1 sm:mx-2 mt-[-1.5rem] sm:mt-[-2rem] min-w-[20px]', {
                    'bg-primary': completed,
                    'bg-muted': !completed,
                  })}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Progress bar variant showing percentage completion
 */
export interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function ProgressStepper({
  currentStep,
  totalSteps,
  className,
}: ProgressStepperProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
