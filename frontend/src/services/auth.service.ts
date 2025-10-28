/**
 * Authentication Service
 * 
 * Handles phone-based OTP authentication flow.
 */

import { api } from '@/lib/api';
import type {
  RequestOtpDto,
  OtpResponseDto,
  VerifyOtpDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  PhoneValidation,
} from '@/types/auth';

/**
 * Authentication service class
 */
export class AuthService {
  /**
   * Request OTP for phone number
   */
  static async requestOtp(phone: string, countryCode: string = '+91'): Promise<OtpResponseDto> {
    try {
      const payload: RequestOtpDto = {
        phone: phone.replace(/\D/g, ''), // Remove non-digits
        countryCode,
      };

      const response = await api.post('/auth/request-otp', payload);
      return response.data;
    } catch (error: any) {
      console.error('OTP request failed:', error);
      throw new Error(
        error?.response?.data?.message || 'Failed to send OTP. Please try again.'
      );
    }
  }

  /**
   * Verify OTP and login
   */
  static async verifyOtp(
    phone: string,
    otp: string,
    name?: string
  ): Promise<LoginResponseDto> {
    try {
      const payload: VerifyOtpDto = {
        phone: phone.replace(/\D/g, ''),
        otp: otp.replace(/\D/g, ''),
        name,
      };

      const response = await api.post('/auth/verify-otp', payload);
      return response.data;
    } catch (error: any) {
      console.error('OTP verification failed:', error);
      throw new Error(
        error?.response?.data?.message || 'Invalid OTP. Please try again.'
      );
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    try {
      const response = await api.post('/auth/refresh', { refreshToken });
      return response.data;
    } catch (error: any) {
      console.error('Token refresh failed:', error);
      throw new Error('Session expired. Please login again.');
    }
  }

  /**
   * Validate phone number format
   */
  static validatePhone(phone: string, countryCode: string = '+91'): PhoneValidation {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');

    // Indian phone number validation (10 digits)
    if (countryCode === '+91') {
      if (cleanPhone.length !== 10) {
        return {
          isValid: false,
          error: 'Phone number must be 10 digits',
        };
      }

      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return {
          isValid: false,
          error: 'Invalid Indian phone number',
        };
      }

      return {
        isValid: true,
        formatted: `${countryCode} ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`,
      };
    }

    // Generic validation for other countries
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      return {
        isValid: false,
        error: 'Invalid phone number length',
      };
    }

    return {
      isValid: true,
      formatted: `${countryCode} ${cleanPhone}`,
    };
  }

  /**
   * Format phone number for display
   */
  static formatPhoneNumber(phone: string, countryCode: string = '+91'): string {
    const cleanPhone = phone.replace(/\D/g, '');

    if (countryCode === '+91' && cleanPhone.length === 10) {
      return `${countryCode} ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`;
    }

    return `${countryCode} ${cleanPhone}`;
  }

  /**
   * Validate OTP format
   */
  static validateOtp(otp: string): boolean {
    const cleanOtp = otp.replace(/\D/g, '');
    return cleanOtp.length === 6;
  }

  /**
   * Check if user is authenticated (from localStorage)
   */
  static isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    
    const token = localStorage.getItem('auth-token');
    return !!token;
  }

  /**
   * Get stored auth token
   */
  static getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    return localStorage.getItem('auth-token');
  }

  /**
   * Clear auth data
   */
  static clearAuth(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem('auth-token');
  }
}
