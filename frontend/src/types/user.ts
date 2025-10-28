/**
 * User Type Definitions
 * 
 * Types for user profiles, preferences, and related data.
 */

import type { UserRole } from './auth';

/**
 * User profile data
 */
export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: UserRole;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
  preferences?: UserPreferences;
  metadata?: Record<string, any>;
}

/**
 * User preferences
 */
export interface UserPreferences {
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  theme: 'light' | 'dark' | 'system';
}

/**
 * User profile update DTO
 */
export interface UpdateUserDto {
  name?: string;
  email?: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * User creation DTO (during OTP verification)
 */
export interface CreateUserDto {
  phone: string;
  name: string;
  email?: string;
  role?: UserRole;
  tenantId: string;
}

/**
 * User statistics for dashboard
 */
export interface UserStats {
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  currency: string;
}

/**
 * User notification preferences
 */
export interface NotificationSettings {
  bookingConfirmation: boolean;
  bookingReminder: boolean;
  paymentReceipt: boolean;
  promotions: boolean;
  newsletter: boolean;
}
