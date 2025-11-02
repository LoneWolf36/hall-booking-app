"use client";

/**
 * Authentication Context Provider
 * 
 * Provides authentication state and actions to the entire application.
 * Wraps Zustand auth store with React Context for better component integration.
 */

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore, useTokenRefresh } from '@/stores/auth-store';
import { AuthService } from '@/services/auth.service';
import { toast } from 'sonner';

interface AuthContextValue {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  error: string | null;
  
  // Actions
  login: (phone: string, name?: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    isAuthenticated,
    isLoading,
    user,
    error,
    setAuth,
    logout: logoutStore,
    setLoading,
    setError,
    clearError,
  } = useAuthStore();
  
  const { checkAndRefreshToken } = useTokenRefresh();

  // Auto-refresh token on mount and periodically
  useEffect(() => {
    if (isAuthenticated) {
      checkAndRefreshToken();
      
      // Set up periodic token refresh (every 10 minutes)
      const interval = setInterval(checkAndRefreshToken, 10 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, checkAndRefreshToken]);

  const login = async (phone: string, name?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await AuthService.requestOtp(phone);
      toast.success(response.message || 'OTP sent successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send OTP';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (phone: string, otp: string, name?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await AuthService.verifyOtp(phone, otp, name);
      setAuth(response);
      
      toast.success(`Welcome ${response.user.name}!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid OTP';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    logoutStore();
    toast.info('Logged out successfully');
  };

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    verifyOtp,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };