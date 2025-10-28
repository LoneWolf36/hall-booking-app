/**
 * Auth Store - Zustand State Management
 * 
 * Manages authentication state, JWT tokens, and user session.
 * Persisted to localStorage with automatic token refresh.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LoginResponseDto, RequestUser } from '@/types/auth';
import { api } from '@/lib/api';

/**
 * Auth state interface
 */
export interface AuthState {
  // Authentication status
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // User data
  user: LoginResponseDto['user'] | null;
  
  // Tokens
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // timestamp
  
  // Error state
  error: string | null;
}

/**
 * Auth actions interface
 */
export interface AuthActions {
  // Login/Logout
  setAuth: (loginResponse: LoginResponseDto) => void;
  logout: () => void;
  
  // Token management
  setAccessToken: (token: string, expiresIn: number) => void;
  refreshAccessToken: () => Promise<boolean>;
  isTokenExpired: () => boolean;
  
  // User management
  updateUser: (user: Partial<LoginResponseDto['user']>) => void;
  
  // UI state
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Helpers
  getAuthHeader: () => string | null;
  getCurrentUser: () => RequestUser | null;
}

/**
 * Initial state
 */
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  error: null,
};

/**
 * Auth store with persistence
 */
export const useAuthStore = create<AuthState & AuthActions>()(
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
          isLoading: false,
        });

        // Store token in localStorage for API client
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth-token', loginResponse.accessToken);
        }
      },

      logout: () => {
        set(initialState);
        
        // Clear token from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-token');
        }
      },

      // Token management
      setAccessToken: (token, expiresIn) => {
        const expiresAt = Date.now() + expiresIn * 1000;
        
        set({
          accessToken: token,
          expiresAt,
        });

        // Update localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth-token', token);
        }
      },

      refreshAccessToken: async () => {
        const state = get();
        
        if (!state.refreshToken) {
          return false;
        }

        try {
          set({ isLoading: true });
          
          const response = await api.post('/auth/refresh', {
            refreshToken: state.refreshToken,
          });

          const { accessToken, expiresIn } = response.data;
          
          get().setAccessToken(accessToken, expiresIn);
          
          set({ isLoading: false });
          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
          return false;
        }
      },

      isTokenExpired: () => {
        const state = get();
        
        if (!state.expiresAt) {
          return true;
        }

        // Consider token expired if it expires in less than 5 minutes
        const bufferTime = 5 * 60 * 1000; // 5 minutes
        return Date.now() + bufferTime >= state.expiresAt;
      },

      // User management
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),

      // UI state
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Helpers
      getAuthHeader: () => {
        const state = get();
        return state.accessToken ? `Bearer ${state.accessToken}` : null;
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
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist auth data, not loading/error state
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      }),
    }
  )
);

/**
 * Hook to check and refresh token automatically
 */
export const useTokenRefresh = () => {
  const { isTokenExpired, refreshAccessToken, logout } = useAuthStore();

  const checkAndRefreshToken = async () => {
    if (isTokenExpired()) {
      const refreshed = await refreshAccessToken();
      
      if (!refreshed) {
        logout();
        return false;
      }
    }
    
    return true;
  };

  return { checkAndRefreshToken };
};
