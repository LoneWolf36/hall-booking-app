/**
 * Step Guard Hook
 * 
 * Ensures users can't access booking steps without proper prerequisites.
 * Provides intelligent navigation and error recovery.
 */

'use client';

import { useEffect } from 'react';
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
  'event_details': {
    requires: (state) => state.selectedVenue && state.selectedDates.length > 0,
    redirectTo: '/booking',
    message: 'Please select a venue and dates first',
  },
  'addons': {
    requires: (state) => state.selectedVenue && state.selectedDates.length > 0 && state.eventType,
    redirectTo: '/event-details',
    message: 'Please complete event details first',
  },
  'payment_method': {
    requires: (state) => state.selectedVenue && state.selectedDates.length > 0 && state.eventType,
    redirectTo: '/event-details',
    message: 'Please complete event details first',
  },
  'auth': {
    requires: (state) => state.selectedVenue && state.selectedDates.length > 0 && state.paymentMethod,
    redirectTo: '/payment-method',
    message: 'Please select a payment method first',
  },
  'confirmation': {
    requires: (state) => {
      // Requires auth token AND complete booking details
      const hasAuth = typeof window !== 'undefined' && localStorage.getItem('auth-token');
      return hasAuth && state.selectedVenue && state.selectedDates.length > 0 && state.eventType;
    },
    redirectTo: '/auth',
    message: 'Please login to continue with your booking',
  },
  'processing': {
    requires: (state) => state.bookingId,
    redirectTo: '/confirmation',
    message: 'Please confirm your booking first',
  },
  'success': {
    requires: (state) => state.bookingId && state.bookingNumber,
    redirectTo: '/booking',
    message: 'Booking session expired. Please start over.',
  },
};

/**
 * Hook to guard booking flow steps and ensure proper navigation
 */
export function useStepGuard(currentStep: BookingStep) {
  const router = useRouter();
  const bookingState = useBookingStore();
  const { setCurrentStep } = useBookingStore();

  useEffect(() => {
    const requirement = STEP_REQUIREMENTS[currentStep];
    
    if (requirement && !requirement.requires(bookingState)) {
      toast.error(requirement.message);
      setCurrentStep(currentStep); // Update store
      router.push(requirement.redirectTo);
    } else {
      // Valid step - update store
      setCurrentStep(currentStep);
    }
  }, [currentStep, bookingState, router, setCurrentStep]);

  return {
    isValid: !STEP_REQUIREMENTS[currentStep] || STEP_REQUIREMENTS[currentStep].requires(bookingState),
    bookingState,
  };
}

/**
 * Hook for back navigation with intelligent fallback
 */
export function useBookingNavigation() {
  const router = useRouter();
  const { getPreviousStep, currentStep } = useBookingStore();

  const goBack = () => {
    try {
      // Try browser back first
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        // Fallback to step navigation
        const previousStep = getPreviousStep();
        if (previousStep) {
          const route = stepToRoute(previousStep);
          router.push(route);
        } else {
          // Last resort - go to booking
          router.push('/booking');
        }
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Safety net
      router.push('/booking');
    }
  };

  const goToStep = (step: BookingStep) => {
    const route = stepToRoute(step);
    router.push(route);
  };

  return {
    goBack,
    goToStep,
    currentStep,
  };
}

/**
 * Convert booking step to route path
 */
function stepToRoute(step: BookingStep): string {
  const routes: Record<BookingStep, string> = {
    'venue_selection': '/booking',
    'event_details': '/event-details',
    'addons': '/addons',
    'payment_method': '/payment-method',
    'auth': '/auth',
    'confirmation': '/confirmation',
    'processing': '/processing',
    'success': '/success',
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
    '/payment-method': 'payment_method',
    '/auth': 'auth',
    '/confirmation': 'confirmation',
    '/processing': 'processing',
    '/success': 'success',
  };
  
  return steps[route] || 'venue_selection';
}