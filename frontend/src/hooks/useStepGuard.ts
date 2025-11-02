/**
 * Step Guard Hook (loop-safe)
 * 
 * Prevents infinite updates by only calling setCurrentStep when it changes.
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
    redirectTo: '/event-details',
    message: 'Please complete event details first',
  },
  auth: {
    requires: (s) => s.selectedVenue && s.selectedDates.length > 0 && s.paymentMethod,
    redirectTo: '/payment-method',
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

export function useStepGuard(currentStep: BookingStep) {
  const router = useRouter();
  const bookingState = useBookingStore();
  const { setCurrentStep, currentStep: storeStep } = useBookingStore();

  // Run at most once per mount for a given step
  const didSetRef = useRef<string | null>(null);

  useEffect(() => {
    const requirement = STEP_REQUIREMENTS[currentStep];

    // 1) Update current step in store only if changed and not already set for this mount
    if (storeStep !== currentStep && didSetRef.current !== currentStep) {
      setCurrentStep(currentStep);
      didSetRef.current = currentStep;
    }

    // 2) If requirement fails, redirect (only once)
    if (requirement && !requirement.requires(bookingState)) {
      // avoid repeated toasts and pushes
      if (didSetRef.current !== `${currentStep}:redirected`) {
        toast.error(requirement.message);
        didSetRef.current = `${currentStep}:redirected`;
        router.push(requirement.redirectTo);
      }
    }
  }, [currentStep, storeStep, bookingState, setCurrentStep, router]);

  const isValid = !STEP_REQUIREMENTS[currentStep] || STEP_REQUIREMENTS[currentStep].requires(bookingState);

  return { isValid, bookingState };
}

export function useBookingNavigation() {
  const router = useRouter();
  const { getPreviousStep, currentStep } = useBookingStore();

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    const previousStep = getPreviousStep();
    router.push(stepToRoute(previousStep || 'venue_selection'));
  };

  const goToStep = (step: BookingStep) => router.push(stepToRoute(step));

  return { goBack, goToStep, currentStep };
}

function stepToRoute(step: BookingStep): string {
  const routes: Record<BookingStep, string> = {
    venue_selection: '/booking',
    event_details: '/event-details',
    addons: '/addons',
    payment_method: '/payment-method',
    auth: '/auth',
    confirmation: '/confirmation',
    processing: '/processing',
    success: '/success',
  };
  return routes[step] || '/booking';
}

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
