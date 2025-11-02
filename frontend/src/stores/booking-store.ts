/**
 * Booking Store - Enhanced with Time Slot Support
 * 
 * Complete flow management with:
 * - Persistent state across navigation and refresh
 * - Step navigation with back support
 * - Multi-date selection and editing
 * - Time slot support with pricing multipliers
 * - Proper rehydration and error recovery
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Venue } from '@/types/venue';
import type { PaymentMethod, PaymentProfile } from '@/types/payment';
import { formatDateForAPI } from '@/lib/dates';

export type BookingStep = 
  | 'venue_selection'
  | 'event_details'
  | 'addons'
  | 'payment_method'
  | 'auth'
  | 'confirmation'
  | 'processing'
  | 'success';

export type EventType = 
  | 'wedding'
  | 'corporate'
  | 'birthday'
  | 'conference'
  | 'party'
  | 'other';

export interface AddonItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  category: 'catering' | 'decoration' | 'equipment' | 'photography' | 'other';
}

export interface TimeSlotInfo {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  duration: number;
  priceMultiplier: number;
}

export interface BookingState {
  // Navigation - Enhanced persistence
  currentStep: BookingStep;
  completedSteps: BookingStep[];
  stepHistory: BookingStep[];
  navigationLocked: boolean; // Prevent clearing state during navigation
  
  // Venue selection
  selectedVenue: Venue | null;
  selectedDates: Date[];
  selectedDate: Date | null; // Backward compatibility
  startTime: string | null;
  endTime: string | null;
  timeSlot: TimeSlotInfo | null; // Enhanced time slot info
  
  // Event details
  eventType: EventType | null;
  guestCount: number;
  specialRequests: string;
  
  // Add-ons
  selectedAddons: AddonItem[];
  
  // Payment
  paymentMethod: PaymentMethod | null;
  paymentProfile: PaymentProfile | null;
  
  // Pricing with time slot support
  basePrice: number;
  adjustedBasePrice: number; // Price after time slot multiplier
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

export interface BookingActions {
  // Navigation - Enhanced with lock
  setCurrentStep: (step: BookingStep) => void;
  markStepCompleted: (step: BookingStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => BookingStep | null;
  getPreviousStep: () => BookingStep | null;
  lockNavigation: () => void;
  unlockNavigation: () => void;
  resetFlow: () => void;
  
  // Venue selection with time slot
  setVenueDetails: (venue: Venue, dates: Date[], startTime: string, endTime: string, timeSlot?: TimeSlotInfo) => void;
  setSelectedDates: (dates: Date[]) => void;
  removeSelectedDate: (date: Date) => void;
  clearSelectedDates: () => void;
  setTimeSlot: (timeSlot: TimeSlotInfo) => void;
  
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

const initialState: BookingState = {
  currentStep: 'venue_selection',
  completedSteps: [],
  stepHistory: [],
  navigationLocked: false,
  selectedVenue: null,
  selectedDates: [],
  selectedDate: null,
  startTime: null,
  endTime: null,
  timeSlot: null,
  eventType: null,
  guestCount: 0,
  specialRequests: '',
  selectedAddons: [],
  paymentMethod: null,
  paymentProfile: null,
  basePrice: 0,
  adjustedBasePrice: 0,
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

export const useBookingStore = create<BookingState & BookingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Navigation - Enhanced with locking
      setCurrentStep: (step) => {
        const state = get();
        if (state.navigationLocked) return;
        
        const current = state.currentStep;
        const history = state.stepHistory;
        
        // Add current step to history if different
        if (current !== step && !history.includes(current)) {
          set({ 
            currentStep: step,
            stepHistory: [...history, current]
          });
        } else {
          set({ currentStep: step });
        }
      },
      
      lockNavigation: () => set({ navigationLocked: true }),
      unlockNavigation: () => set({ navigationLocked: false }),
      
      markStepCompleted: (step) => set((state) => ({
        completedSteps: state.completedSteps.includes(step)
          ? state.completedSteps
          : [...state.completedSteps, step],
      })),
      
      goToNextStep: () => {
        const currentIndex = STEP_ORDER.indexOf(get().currentStep);
        if (currentIndex < STEP_ORDER.length - 1) {
          get().setCurrentStep(STEP_ORDER[currentIndex + 1]);
        }
      },
      
      goToPreviousStep: () => {
        return get().getPreviousStep();
      },
      
      getPreviousStep: () => {
        const state = get();
        const history = state.stepHistory;
        const currentIndex = STEP_ORDER.indexOf(state.currentStep);
        
        // Try to get from history first (preserve flow)
        if (history.length > 0) {
          const previousStep = history[history.length - 1];
          // Remove from history and set as current
          set({ 
            stepHistory: history.slice(0, -1),
            currentStep: previousStep 
          });
          return previousStep;
        }
        
        // Fallback to step order
        if (currentIndex > 0) {
          const previousStep = STEP_ORDER[currentIndex - 1];
          set({ currentStep: previousStep });
          return previousStep;
        }
        
        return null;
      },
      
      resetFlow: () => {
        set({ ...initialState, navigationLocked: false });
      },

      // Venue selection with enhanced time slot support
      setVenueDetails: (venue, dates, startTime, endTime, timeSlot) => {
        const basePrice = venue.basePriceCents / 100;
        const multiplier = timeSlot?.priceMultiplier || 1.0;
        const adjustedPrice = Math.round(basePrice * multiplier);
        
        set({
          selectedVenue: venue,
          selectedDates: dates,
          selectedDate: dates.length > 0 ? dates[0] : null,
          startTime,
          endTime,
          timeSlot,
          basePrice,
          adjustedBasePrice: adjustedPrice,
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
      
      removeSelectedDate: (dateToRemove: Date) => {
        const currentDates = get().selectedDates;
        const newDates = currentDates.filter(date => 
          date.toDateString() !== dateToRemove.toDateString()
        );
        get().setSelectedDates(newDates);
      },
      
      clearSelectedDates: () => {
        set({ selectedDates: [], selectedDate: null });
        get().calculateTotals();
      },
      
      setTimeSlot: (timeSlot: TimeSlotInfo) => {
        const state = get();
        const basePrice = state.basePrice;
        const adjustedPrice = Math.round(basePrice * timeSlot.priceMultiplier);
        
        set({
          timeSlot,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          adjustedBasePrice: adjustedPrice,
        });
        get().calculateTotals();
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

      // Enhanced pricing with time slot support
      calculateTotals: () => {
        const state = get();
        const daysCount = state.selectedDates.length || 1;
        const effectiveBasePrice = state.adjustedBasePrice || state.basePrice;
        
        // Calculate add-ons total
        const addonsTotal = state.selectedAddons.reduce(
          (sum, addon) => sum + addon.price * addon.quantity,
          0
        );
        
        // Calculate venue subtotal with time slot pricing
        const venueSubtotal = effectiveBasePrice * daysCount;
        const subtotal = venueSubtotal + addonsTotal;
        
        // Calculate taxes (18% GST)
        const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
        
        // Calculate platform fee based on payment profile
        let platformFeePercentage = 0;
        if (state.paymentProfile === 'cash_only') platformFeePercentage = 0.05;
        else if (state.paymentProfile === 'cash_deposit' || state.paymentProfile === 'hybrid') platformFeePercentage = 0.08;
        else if (state.paymentProfile === 'full_online') platformFeePercentage = 0.12;
        else if (state.paymentProfile === 'marketplace') platformFeePercentage = 0.15;
        
        const platformFee = Math.round(subtotal * platformFeePercentage * 100) / 100;
        const totalAmount = Math.round((subtotal + taxAmount + platformFee - state.discount) * 100) / 100;

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
        // Persist core booking data
        selectedVenue: state.selectedVenue,
        selectedDates: state.selectedDates,
        selectedDate: state.selectedDate,
        startTime: state.startTime,
        endTime: state.endTime,
        timeSlot: state.timeSlot,
        eventType: state.eventType,
        guestCount: state.guestCount,
        specialRequests: state.specialRequests,
        selectedAddons: state.selectedAddons,
        paymentMethod: state.paymentMethod,
        paymentProfile: state.paymentProfile,
        basePrice: state.basePrice,
        adjustedBasePrice: state.adjustedBasePrice,
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
        stepHistory: state.stepHistory,
        // Don't persist navigationLocked - always start unlocked
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert string dates back to Date objects after rehydration
          if (state.selectedDates) {
            state.selectedDates = state.selectedDates.map((d: any) => 
              d instanceof Date ? d : new Date(d)
            );
          }
          if (state.selectedDate && !(state.selectedDate instanceof Date)) {
            state.selectedDate = new Date(state.selectedDate);
          }
          // Ensure navigation is unlocked on app start
          state.navigationLocked = false;
        }
      },
    }
  )
);