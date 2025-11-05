/**
 * Auth Store - Enhanced Zustand State Management
 * 
 * Manages authentication state, JWT tokens, and user session.
 * Enhanced with better error handling, hydration fixes, and SSR compatibility.
 * 
 * FIXES APPLIED:
 * - Fixed hydration issues causing "No authentication token available" errors
 * - Added proper SSR compatibility
 * - Enhanced error handling and recovery
 * - Improved token synchronization between localStorage and Zustand
 * - Added automatic retry mechanisms
 * - Better loading state management
 */

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import type { LoginResponseDto, RequestUser } from '@/types/auth';
import { api } from '@/lib/api';

/**
 * Auth state interface
 */
export interface AuthState {
  // Authentication status
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean; // NEW: Track hydration state
  
  // User data
  user: LoginResponseDto['user'] | null;
  
  // Tokens
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // timestamp
  
  // Enhanced error state
  error: string | null;
  lastError: {
    message: string;
    code?: string;
    timestamp: number;
  } | null;
  
  // Retry state
  retryCount: number;
  isRetrying: boolean;
}

/**
 * Auth actions interface
 */
export interface AuthActions {
  // Login/Logout
  setAuth: (loginResponse: LoginResponseDto) => void;
  logout: (reason?: string) => void;
  
  // Token management
  setAccessToken: (token: string, expiresIn: number) => void;
  refreshAccessToken: () => Promise<boolean>;
  isTokenExpired: () => boolean;
  syncTokenFromStorage: () => void; // NEW: Sync token from localStorage
  
  // User management
  updateUser: (user: Partial<LoginResponseDto['user']>) => void;
  
  // UI state
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null, code?: string) => void;
  clearError: () => void;
  setInitialized: (initialized: boolean) => void; // NEW
  
  // Enhanced helpers
  getAuthHeader: () => string | null;
  getCurrentUser: () => RequestUser | null;
  hasValidToken: () => boolean; // NEW: Check if we have a valid, non-expired token
  
  // Recovery methods
  resetRetryCount: () => void;
  incrementRetryCount: () => void;
}

/**
 * Initial state
 */
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  error: null,
  lastError: null,
  retryCount: 0,
  isRetrying: false,
};

/**
 * Custom storage implementation with better error handling
 */
const createSafeStorage = (): StateStorage => {
  const isClientSide = typeof window !== 'undefined';
  
  return {
    getItem: (name: string): string | null => {
      try {
        if (!isClientSide) return null;
        return localStorage.getItem(name);
      } catch (error) {
        console.warn(`Failed to read from localStorage:`, error);
        return null;
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        if (!isClientSide) return;
        localStorage.setItem(name, value);
      } catch (error) {
        console.warn(`Failed to write to localStorage:`, error);
      }
    },
    removeItem: (name: string): void => {
      try {
        if (!isClientSide) return;
        localStorage.removeItem(name);
      } catch (error) {
        console.warn(`Failed to remove from localStorage:`, error);
      }
    },
  };
};

/**
 * Enhanced Auth store with better persistence and error handling
 */
export const useAuthStore = create<AuthState & AuthActions>()()
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Login/Logout
        setAuth: (loginResponse) => {
          const expiresAt = Date.now() + loginResponse.expiresIn * 1000;
          
          set({
            isAuthenticated: true,
            user: loginResponse.user,
            accessToken: loginResponse.accessToken,
            refreshToken: loginResponse.refreshToken,
            expiresAt,
            error: null,
            lastError: null,
            isLoading: false,
            retryCount: 0,
            isRetrying: false,
          });

          // Sync with localStorage for compatibility with existing code
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('auth-token', loginResponse.accessToken);
              localStorage.setItem('token', loginResponse.accessToken); // Legacy support
            } catch (error) {
              console.warn('Failed to sync token to localStorage:', error);
            }
          }
        },

        logout: (reason) => {
          const logoutState = {
            ...initialState,
            isInitialized: true, // Keep initialization state
          };
          
          set(logoutState);
          
          // Clear all tokens from localStorage
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('auth-token');
              localStorage.removeItem('token'); // Legacy support
            } catch (error) {
              console.warn('Failed to clear tokens from localStorage:', error);
            }
          }
          
          if (reason) {
            console.log('User logged out:', reason);
          }
        },

        // Enhanced token management
        setAccessToken: (token, expiresIn) => {
          const expiresAt = Date.now() + expiresIn * 1000;
          
          set({
            accessToken: token,
            expiresAt,
          });

          // Sync with localStorage
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('auth-token', token);
              localStorage.setItem('token', token); // Legacy support
            } catch (error) {
              console.warn('Failed to sync token to localStorage:', error);
            }
          }
        },

        refreshAccessToken: async () => {
          const state = get();
          
          if (!state.refreshToken) {
            console.log('No refresh token available');
            return false;
          }

          if (state.isRetrying) {
            console.log('Token refresh already in progress');
            return false;
          }

          try {
            set({ isLoading: true, isRetrying: true });
            
            const response = await api.post('/auth/refresh', {
              refreshToken: state.refreshToken,
            });

            const { accessToken, expiresIn } = response.data;
            
            get().setAccessToken(accessToken, expiresIn);
            
            set({ 
              isLoading: false, 
              isRetrying: false,
              error: null,
              lastError: null,
              retryCount: 0,
            });
            
            console.log('Token refreshed successfully');
            return true;
          } catch (error) {
            console.error('Token refresh failed:', error);
            
            set({
              isLoading: false,
              isRetrying: false,
              error: 'Failed to refresh authentication token',
              lastError: {
                message: error instanceof Error ? error.message : 'Token refresh failed',
                code: 'TOKEN_REFRESH_FAILED',
                timestamp: Date.now(),
              },
            });
            
            // Only logout after max retries
            if (state.retryCount >= 3) {
              get().logout('Maximum token refresh attempts exceeded');
            } else {
              get().incrementRetryCount();
            }
            
            return false;
          }
        },

        isTokenExpired: () => {
          const state = get();
          
          if (!state.expiresAt || !state.accessToken) {
            return true;
          }

          // Consider token expired if it expires in less than 5 minutes
          const bufferTime = 5 * 60 * 1000; // 5 minutes
          return Date.now() + bufferTime >= state.expiresAt;
        },

        // NEW: Sync token from localStorage (for hydration)
        syncTokenFromStorage: () => {
          if (typeof window === 'undefined') return;
          
          try {
            const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
            const state = get();
            
            // If we have a token in storage but not in state, try to sync
            if (token && !state.accessToken && !state.isAuthenticated) {
              console.log('Syncing token from localStorage');
              // Note: We can't determine expiration from localStorage alone
              // This is a fallback that should trigger a proper auth check
              set({
                accessToken: token,
                // Don't set isAuthenticated=true without proper validation
                error: null,
              });
            }
          } catch (error) {
            console.warn('Failed to sync token from localStorage:', error);
          }
        },

        // User management
        updateUser: (updates) => set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

        // Enhanced UI state management
        setLoading: (isLoading) => set({ isLoading }),
        
        setError: (error, code) => set((state) => ({
          error,
          lastError: error ? {
            message: error,
            code,
            timestamp: Date.now(),
          } : null,
        })),
        
        clearError: () => set({ error: null }),
        
        setInitialized: (isInitialized) => set({ isInitialized }),

        // Enhanced helpers
        getAuthHeader: () => {
          const state = get();
          if (!state.accessToken) {
            // Try to sync from localStorage as fallback
            get().syncTokenFromStorage();
            const updatedState = get();
            return updatedState.accessToken ? `Bearer ${updatedState.accessToken}` : null;
          }
          return `Bearer ${state.accessToken}`;
        },

        getCurrentUser: () => {
          const state = get();
          
          if (!state.user || !state.isAuthenticated) {
            return null;
          }

          return {
            userId: state.user.id,
            phone: state.user.phone,
            role: state.user.role,
            tenantId: 'default', // TODO: Extract from JWT
          };
        },

        // NEW: Check if we have a valid, non-expired token
        hasValidToken: () => {
          const state = get();
          return !!(state.accessToken && !get().isTokenExpired());
        },

        // Recovery methods
        resetRetryCount: () => set({ retryCount: 0 }),
        incrementRetryCount: () => set((state) => ({ retryCount: state.retryCount + 1 })),
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => createSafeStorage()),
        partialize: (state) => ({
          // Only persist auth data, not loading/error state
          isAuthenticated: state.isAuthenticated,
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          expiresAt: state.expiresAt,
          // Persist some error info for debugging
          lastError: state.lastError,
        }),
        onRehydrateStorage: (state) => {
          console.log('Auth store: Starting hydration');
          return (state, error) => {
            if (error) {
              console.error('Auth store: Hydration failed:', error);
            } else {
              console.log('Auth store: Hydration complete');
              // Mark as initialized after hydration
              state?.setInitialized(true);
              
              // Check token validity after hydration
              if (state?.accessToken && state?.isTokenExpired()) {
                console.log('Auth store: Token expired after hydration, attempting refresh');
                state?.refreshAccessToken();
              } else if (state?.accessToken) {
                console.log('Auth store: Valid token found after hydration');
              }
            }
          };
        },
      }
    )
  )
);

/**
 * Enhanced hook for automatic token refresh with better error handling
 */
export const useTokenRefresh = () => {
  const { 
    isTokenExpired, 
    refreshAccessToken, 
    logout, 
    hasValidToken,
    isRetrying,
    retryCount 
  } = useAuthStore();

  const checkAndRefreshToken = async (): Promise<boolean> => {
    // Don't attempt refresh if already retrying or exceeded max retries
    if (isRetrying || retryCount >= 3) {
      return hasValidToken();
    }

    if (isTokenExpired()) {
      console.log('Token expired, attempting refresh');
      const refreshed = await refreshAccessToken();
      
      if (!refreshed) {
        console.log('Token refresh failed, user will be logged out');
        return false;
      }
      
      console.log('Token refreshed successfully');
    }
    
    return true;
  };

  return { 
    checkAndRefreshToken,
    hasValidToken: hasValidToken(),
    isRetrying,
    retryCount,
  };
};

/**
 * NEW: Hook for handling hydration and initialization
 */
export const useAuthHydration = () => {
  const { isInitialized, setInitialized, syncTokenFromStorage } = useAuthStore();
  
  // Force initialization on client side
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      console.log('Auth: Initializing client-side');
      syncTokenFromStorage();
      setInitialized(true);
    }
  }, [isInitialized, setInitialized, syncTokenFromStorage]);
  
  return { isInitialized };
};

/**
 * NEW: Debug hook for development
 */
export const useAuthDebug = () => {
  const state = useAuthStore();
  
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Auth State Debug:', {
        isAuthenticated: state.isAuthenticated,
        hasToken: !!state.accessToken,
        isExpired: state.isTokenExpired(),
        isInitialized: state.isInitialized,
        error: state.error,
        retryCount: state.retryCount,
      });
    }
  }, [state.isAuthenticated, state.accessToken, state.error, state.isInitialized]);
};

// Add React import for new hooks
import React from 'react';