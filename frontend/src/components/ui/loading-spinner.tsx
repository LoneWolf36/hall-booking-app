/**
 * Loading Spinner Component
 * 
 * Reusable loading spinner with different sizes and variants.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { LoaderIcon } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  className, 
  text 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };
  
  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base', 
    xl: 'text-lg'
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <LoaderIcon 
        className={cn(
          'animate-spin text-primary', 
          sizeClasses[size]
        )} 
      />
      {text && (
        <p className={cn(
          'text-muted-foreground',
          textSizeClasses[size]
        )}>
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * Inline loading spinner for buttons or small spaces
 */
export function InlineSpinner({ className }: { className?: string }) {
  return (
    <LoaderIcon 
      className={cn('h-4 w-4 animate-spin', className)} 
    />
  );
}

/**
 * Full page loading screen
 */
export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <LoadingSpinner size="lg" text={text} className="text-white" />
    </div>
  );
}