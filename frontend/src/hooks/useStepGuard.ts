/**
 * Step Guard Hook - Enhanced Navigation with State Preservation
 * 
 * Fixes:
 * - Prevents infinite loops with conditional setCurrentStep
 * - Preserves state during navigation
 * - Smart back navigation that doesn't reset data
 */

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore, type BookingStep } from '@/stores';
import { toast } from 'sonner';

interface StepRequirements {
  [key: string]: {
    requires: (state: any) => boolean;
    redirectTo: string;
    message: string;
  };
}

const STEP_REQUIREMENTS: StepRequirements = {
  event_details: {
    requires: (s) => s.selectedVenue && s.selectedDates.length > 0,
    redirectTo: '/booking',
    message: 'Please select a venue and dates first',
  },
  addons: {
    requires: (s) => s.selectedVenue && s.selectedDates.length > 0 && s.eventType,
    redirectTo: '/event-details',
    message: 'Please complete event details first',
  },
  payment_method: {
    requires: (s) => s.selectedVenue && s.selectedDates.length > 0 && s.eventType,
    redirectTo: '/addons',
    message: 'Please complete event details first',
  },
  auth: {
    requires: (s) => s.selectedVenue && s.selectedDates.length > 0 && s.paymentMethod,
    redirectTo: '/payment',
    message: 'Please select a payment method first',
  },
  confirmation: {
    requires: (s) => {
      const hasAuth = typeof window !== 'undefined' && localStorage.getItem('auth-token');
      return hasAuth && s.selectedVenue && s.selectedDates.length > 0 && s.eventType;
    },
    redirectTo: '/auth',
    message: 'Please login to continue with your booking',
  },
  processing: {
    requires: (s) => s.bookingId,
    redirectTo: '/confirmation',
    message: 'Please confirm your booking first',
  },
  success: {
    requires: (s) => s.bookingId && s.bookingNumber,
    redirectTo: '/booking',
    message: 'Booking session expired. Please start over.',
  },
};

/**
 * Enhanced step guard with state preservation
 */
export function useStepGuard(currentStep: BookingStep) {
  const router = useRouter();
  const bookingState = useBookingStore();
  const { setCurrentStep, currentStep: storeStep, lockNavigation } = useBookingStore();

  // Prevent multiple executions for the same step
  const didProcessRef = useRef<string | null>(null);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const stepKey = `${currentStep}-${Date.now()}`;
    
    // Avoid processing the same step repeatedly
    if (didProcessRef.current === currentStep && hasRedirectedRef.current) {
      return;
    }
    
    didProcessRef.current = currentStep;
    
    // Update store step only if different (prevents loops)
    if (storeStep !== currentStep) {
      setCurrentStep(currentStep);
    }
    
    // Check requirements
    const requirement = STEP_REQUIREMENTS[currentStep];
    if (requirement && !requirement.requires(bookingState)) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        toast.error(requirement.message);
        
        // Lock navigation briefly to preserve state
        lockNavigation();
        
        setTimeout(() => {
          router.push(requirement.redirectTo);
          // Unlock after navigation
          setTimeout(() => {
            useBookingStore.getState().unlockNavigation();
            hasRedirectedRef.current = false;
          }, 100);
        }, 50);
      }
    } else {
      hasRedirectedRef.current = false;
    }
  }, [currentStep, storeStep, bookingState, setCurrentStep, router, lockNavigation]);

  const isValid = !STEP_REQUIREMENTS[currentStep] || STEP_REQUIREMENTS[currentStep].requires(bookingState);

  return { isValid, bookingState };
}

/**
 * Enhanced booking navigation with state preservation
 */
export function useBookingNavigation() {
  const router = useRouter();
  const { getPreviousStep, currentStep, lockNavigation, unlockNavigation } = useBookingStore();

  const goBack = () => {
    try {
      // Lock navigation to preserve state
      lockNavigation();
      
      // Try browser back first (preserves form state better)
      if (typeof window !== 'undefined' && window.history.length > 1) {
        // Brief delay to ensure state is locked before navigation
        setTimeout(() => {
          router.back();
          // Unlock after navigation
          setTimeout(() => unlockNavigation(), 100);
        }, 50);
      } else {
        // Fallback to step navigation
        const previousStep = getPreviousStep();
        const route = stepToRoute(previousStep || 'venue_selection');
        setTimeout(() => {
          router.push(route);
          // Unlock after navigation
          setTimeout(() => unlockNavigation(), 100);
        }, 50);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      unlockNavigation(); // Ensure we don't stay locked
      router.push('/booking'); // Safety fallback
    }
  };

  const goToStep = (step: BookingStep) => {
    lockNavigation();
    const route = stepToRoute(step);
    setTimeout(() => {
      router.push(route);
      setTimeout(() => unlockNavigation(), 100);
    }, 50);
  };

  return { goBack, goToStep, currentStep };
}

/**
 * Convert booking step to route path
 */
function stepToRoute(step: BookingStep): string {
  const routes: Record<BookingStep, string> = {
    venue_selection: '/booking',
    event_details: '/event-details',
    addons: '/addons',
    payment_method: '/payment',
    auth: '/auth',
    confirmation: '/confirmation',
    processing: '/processing',
    success: '/success',
  };
  return routes[step] || '/booking';
}

/**
 * Convert route path to booking step
 */
export function routeToStep(route: string): BookingStep {
  const steps: Record<string, BookingStep> = {
    '/booking': 'venue_selection',
    '/event-details': 'event_details',
    '/addons': 'addons',
    '/payment': 'payment_method',
    '/auth': 'auth',
    '/confirmation': 'confirmation',
    '/processing': 'processing',
    '/success': 'success',
  };
  return steps[route] || 'venue_selection';
}