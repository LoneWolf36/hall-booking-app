/**
 * Booking Store - Zustand State Management
 * 
 * Manages the entire booking flow state across multiple steps.
 * Persisted to localStorage for recovery on page refresh.
 * Enhanced with hold management for temporary date reservations.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Venue } from '@/types/venue';
import type { PaymentMethod, PaymentProfile } from '@/types/payment';
import { createHold, refreshHold, releaseHold, type Hold } from '@/lib/api/holds';
import { formatDateForAPI } from '@/lib/dates';

/**
 * Booking flow steps
 */
export type BookingStep = 
  | 'venue_selection'
  | 'event_details'
  | 'addons'
  | 'payment_method'
  | 'auth'
  | 'confirmation'
  | 'processing'
  | 'success';

/**
 * Event type options
 */
export type EventType = 
  | 'wedding'
  | 'corporate'
  | 'birthday'
  | 'conference'
  | 'party'
  | 'other';

/**
 * Add-on item
 */
export interface AddonItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  category: 'catering' | 'decoration' | 'equipment' | 'photography' | 'other';
}

/**
 * Booking state interface
 */
export interface BookingState {
  // Current step
  currentStep: BookingStep;
  completedSteps: BookingStep[];
  
  // Venue selection
  selectedVenue: Venue | null;
  selectedDates: Date[];
  selectedDate: Date | null; // Kept for backward compatibility
  startTime: string | null;
  endTime: string | null;
  
  // Hold management
  currentHold: Hold | null;
  holdExpiresAt: Date | null;
  holdCountdown: number; // minutes remaining
  isHoldActive: boolean;
  
  // Event details
  eventType: EventType | null;
  guestCount: number;
  specialRequests: string;
  
  // Add-ons (optional)
  selectedAddons: AddonItem[];
  
  // Payment
  paymentMethod: PaymentMethod | null;
  paymentProfile: PaymentProfile | null;
  
  // Pricing
  basePrice: number;
  addonsTotal: number;
  taxAmount: number;
  platformFee: number;
  discount: number;
  totalAmount: number;
  
  // Booking IDs
  bookingId: string | null;
  bookingNumber: string | null;
  idempotencyKey: string | null;
  
  // UI state
  isProcessing: boolean;
  error: string | null;
}

/**
 * Booking actions interface
 */
export interface BookingActions {
  // Step navigation
  setCurrentStep: (step: BookingStep) => void;
  markStepCompleted: (step: BookingStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  resetFlow: () => void;
  
  // Venue selection
  setVenueDetails: (venue: Venue, date: Date, startTime: string, endTime: string) => void;
  setSelectedDates: (dates: Date[]) => void;
  updateSelectedDates: (dates: Date[]) => Promise<void>;
  
  // Hold management
  createDateHold: (venueId: string, dates: Date[], token?: string) => Promise<boolean>;
  refreshDateHold: (token?: string) => Promise<boolean>;
  releaseDateHold: (token?: string) => Promise<void>;
  updateHoldCountdown: () => void;
  startHoldTimer: () => void;
  stopHoldTimer: () => void;
  
  // Event details
  setEventDetails: (eventType: EventType, guestCount: number, specialRequests?: string) => void;
  
  // Add-ons
  addAddon: (addon: AddonItem) => void;
  removeAddon: (addonId: string) => void;
  updateAddonQuantity: (addonId: string, quantity: number) => void;
  clearAddons: () => void;
  
  // Payment
  setPaymentMethod: (method: PaymentMethod, profile: PaymentProfile) => void;
  
  // Pricing
  calculateTotals: () => void;
  setDiscount: (amount: number) => void;
  
  // Booking
  setBookingIds: (bookingId: string, bookingNumber: string) => void;
  generateIdempotencyKey: () => string;
  
  // UI state
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Initial state
 */
const initialState: BookingState = {
  currentStep: 'venue_selection',
  completedSteps: [],
  selectedVenue: null,
  selectedDates: [],
  selectedDate: null,
  startTime: null,
  endTime: null,
  currentHold: null,
  holdExpiresAt: null,
  holdCountdown: 0,
  isHoldActive: false,
  eventType: null,
  guestCount: 0,
  specialRequests: '',
  selectedAddons: [],
  paymentMethod: null,
  paymentProfile: null,
  basePrice: 0,
  addonsTotal: 0,
  taxAmount: 0,
  platformFee: 0,
  discount: 0,
  totalAmount: 0,
  bookingId: null,
  bookingNumber: null,
  idempotencyKey: null,
  isProcessing: false,
  error: null,
};

/**
 * Step flow order
 */
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

// Hold timer reference
let holdTimerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Booking store with persistence and hold management
 */
export const useBookingStore = create<BookingState & BookingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Step navigation
      setCurrentStep: (step) => set({ currentStep: step }),
      
      markStepCompleted: (step) => set((state) => ({
        completedSteps: state.completedSteps.includes(step)
          ? state.completedSteps
          : [...state.completedSteps, step],
      })),
      
      goToNextStep: () => {
        const currentIndex = STEP_ORDER.indexOf(get().currentStep);
        if (currentIndex < STEP_ORDER.length - 1) {
          const nextStep = STEP_ORDER[currentIndex + 1];
          set({ currentStep: nextStep });
        }
      },
      
      goToPreviousStep: () => {
        const currentIndex = STEP_ORDER.indexOf(get().currentStep);
        if (currentIndex > 0) {
          const previousStep = STEP_ORDER[currentIndex - 1];
          set({ currentStep: previousStep });
        }
      },
      
      resetFlow: () => {
        get().stopHoldTimer();
        get().releaseDateHold();
        set(initialState);
      },

      // Venue selection
      setVenueDetails: (venue, date, startTime, endTime) => {
        set({
          selectedVenue: venue,
          selectedDate: date,
          selectedDates: [date],
          startTime,
          endTime,
          basePrice: venue.basePriceCents / 100,
        });
        get().markStepCompleted('venue_selection');
        get().calculateTotals();
      },
      
      setSelectedDates: (dates: Date[]) => {
        set({
          selectedDates: dates,
          selectedDate: dates.length > 0 ? dates[0] : null,
        });
        get().calculateTotals();
      },
      
      updateSelectedDates: async (dates: Date[]) => {
        const { selectedVenue, currentHold } = get();
        
        set({
          selectedDates: dates,
          selectedDate: dates.length > 0 ? dates[0] : null,
        });
        
        if (selectedVenue && dates.length > 0) {
          await get().createDateHold(selectedVenue.id, dates);
        } else if (currentHold) {
          await get().releaseDateHold();
        }
        
        get().calculateTotals();
      },

      // Hold management
      createDateHold: async (venueId: string, dates: Date[], token?: string): Promise<boolean> => {
        try {
          set({ isProcessing: true, error: null });
          
          await get().releaseDateHold(token);
          
          const response = await createHold({
            venueId,
            selectedDates: dates.map(formatDateForAPI),
            duration: 30,
          }, token);
          
          if (response.success && response.data) {
            set({
              currentHold: response.data,
              holdExpiresAt: new Date(response.data.expiresAt),
              isHoldActive: true,
            });
            
            get().startHoldTimer();
            return true;
          } else {
            set({ error: response.message || 'Failed to create hold' });
            return false;
          }
        } catch (error) {
          console.error('Failed to create hold:', error);
          set({ error: 'Failed to create temporary reservation' });
          return false;
        } finally {
          set({ isProcessing: false });
        }
      },
      
      refreshDateHold: async (token?: string): Promise<boolean> => {
        const { currentHold } = get();
        if (!currentHold) return false;
        
        try {
          const response = await refreshHold(currentHold.id, token);
          
          if (response.success && response.data) {
            set({
              currentHold: response.data,
              holdExpiresAt: new Date(response.data.expiresAt),
              isHoldActive: true,
            });
            return true;
          } else {
            set({ 
              currentHold: null,
              holdExpiresAt: null,
              isHoldActive: false,
              error: response.message || 'Hold expired'
            });
            return false;
          }
        } catch (error) {
          console.error('Failed to refresh hold:', error);
          return false;
        }
      },
      
      releaseDateHold: async (token?: string): Promise<void> => {
        const { currentHold } = get();
        if (!currentHold) return;
        
        get().stopHoldTimer();
        
        try {
          await releaseHold(currentHold.id, token);
        } catch (error) {
          console.error('Failed to release hold:', error);
        } finally {
          set({
            currentHold: null,
            holdExpiresAt: null,
            isHoldActive: false,
            holdCountdown: 0,
          });
        }
      },
      
      updateHoldCountdown: () => {
        const { holdExpiresAt, isHoldActive } = get();
        if (!holdExpiresAt || !isHoldActive) return;
        
        const now = new Date();
        const timeLeft = Math.max(0, Math.floor((holdExpiresAt.getTime() - now.getTime()) / (1000 * 60)));
        
        set({ holdCountdown: timeLeft });
        
        if (timeLeft <= 0) {
          set({ isHoldActive: false });
          get().stopHoldTimer();
        }
      },
      
      startHoldTimer: () => {
        get().stopHoldTimer();
        
        holdTimerInterval = setInterval(() => {
          get().updateHoldCountdown();
        }, 60000);
      },
      
      stopHoldTimer: () => {
        if (holdTimerInterval) {
          clearInterval(holdTimerInterval);
          holdTimerInterval = null;
        }
      },

      // Event details
      setEventDetails: (eventType, guestCount, specialRequests = '') => {
        set({
          eventType,
          guestCount,
          specialRequests,
        });
        get().markStepCompleted('event_details');
      },

      // Add-ons
      addAddon: (addon) => set((state) => ({
        selectedAddons: [...state.selectedAddons, addon],
      })),
      
      removeAddon: (addonId) => set((state) => ({
        selectedAddons: state.selectedAddons.filter((a) => a.id !== addonId),
      })),
      
      updateAddonQuantity: (addonId, quantity) => set((state) => ({
        selectedAddons: state.selectedAddons.map((a) =>
          a.id === addonId ? { ...a, quantity } : a
        ),
      })),
      
      clearAddons: () => set({ selectedAddons: [] }),

      // Payment
      setPaymentMethod: (method, profile) => {
        set({
          paymentMethod: method,
          paymentProfile: profile,
        });
        get().markStepCompleted('payment_method');
        get().calculateTotals();
      },

      // Pricing
      calculateTotals: () => {
        const state = get();
        const daysCount = state.selectedDates.length || 1;
        const addonsTotal = state.selectedAddons.reduce(
          (sum, addon) => sum + addon.price * addon.quantity,
          0
        );
        const subtotal = (state.basePrice * daysCount) + addonsTotal;
        const taxAmount = subtotal * 0.18;
        
        let platformFeePercentage = 0;
        if (state.paymentProfile === 'cash_only') platformFeePercentage = 0.05;
        else if (state.paymentProfile === 'cash_deposit' || state.paymentProfile === 'hybrid') platformFeePercentage = 0.08;
        else if (state.paymentProfile === 'full_online') platformFeePercentage = 0.12;
        else if (state.paymentProfile === 'marketplace') platformFeePercentage = 0.15;
        
        const platformFee = subtotal * platformFeePercentage;
        const totalAmount = subtotal + taxAmount + platformFee - state.discount;

        set({
          addonsTotal,
          taxAmount,
          platformFee,
          totalAmount,
        });
      },
      
      setDiscount: (amount) => {
        set({ discount: amount });
        get().calculateTotals();
      },

      // Booking
      setBookingIds: (bookingId, bookingNumber) => set({ bookingId, bookingNumber }),
      
      generateIdempotencyKey: () => {
        const key = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        set({ idempotencyKey: key });
        return key;
      },

      // UI state
      setProcessing: (isProcessing) => set({ isProcessing }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'booking-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedVenue: state.selectedVenue,
        selectedDates: state.selectedDates,
        selectedDate: state.selectedDate,
        startTime: state.startTime,
        endTime: state.endTime,
        currentHold: state.currentHold,
        holdExpiresAt: state.holdExpiresAt,
        eventType: state.eventType,
        guestCount: state.guestCount,
        specialRequests: state.specialRequests,
        selectedAddons: state.selectedAddons,
        paymentMethod: state.paymentMethod,
        paymentProfile: state.paymentProfile,
        basePrice: state.basePrice,
        addonsTotal: state.addonsTotal,
        taxAmount: state.taxAmount,
        platformFee: state.platformFee,
        discount: state.discount,
        totalAmount: state.totalAmount,
        bookingId: state.bookingId,
        bookingNumber: state.bookingNumber,
        idempotencyKey: state.idempotencyKey,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.currentHold && state?.holdExpiresAt) {
          const holdExpiry = new Date(state.holdExpiresAt);
          if (holdExpiry > new Date()) {
            state.isHoldActive = true;
            state.startHoldTimer();
          } else {
            state.currentHold = null;
            state.holdExpiresAt = null;
            state.isHoldActive = false;
          }
        }
      },
    }
  )
);
