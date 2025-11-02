/**
 * Authentication Service
 * 
 * Handles phone-based OTP authentication flow with proper error handling.
 * Fixed to match backend API contract exactly.
 */

import { apiCall } from '@/lib/api/client';
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
   * Fixed to match backend DTO exactly
   */
  static async requestOtp(phone: string, countryCode: string = '+91'): Promise<OtpResponseDto> {
    try {
      // Clean phone number - remove all non-digits
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Validate phone format before sending
      const validation = this.validatePhone(cleanPhone, countryCode);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid phone number');
      }

      const payload = {
        phone: cleanPhone, // Send only digits
        countryCode: countryCode,
        // tenantId will be handled by backend or set to default
      };

      console.log('Requesting OTP with payload:', payload);

      const response = await apiCall('/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to send OTP');
      }

      return {
        success: true,
        message: response.message || 'OTP sent successfully',
        requestId: response.data?.requestId,
        expiresIn: response.data?.expiresIn || 300,
      };
    } catch (error: any) {
      console.error('OTP request failed:', error);
      
      // Handle specific error types
      if (error.name === 'ValidationError') {
        throw new Error('Please check your phone number and try again');
      }
      
      if (error.message?.includes('rate limit')) {
        throw new Error('Too many OTP requests. Please wait before trying again.');
      }
      
      throw new Error(
        error?.message || 'Failed to send OTP. Please check your connection and try again.'
      );
    }
  }

  /**
   * Verify OTP and login
   * Fixed to match backend DTO exactly
   */
  static async verifyOtp(
    phone: string,
    otp: string,
    name?: string
  ): Promise<LoginResponseDto> {
    try {
      // Clean inputs
      const cleanPhone = phone.replace(/\D/g, '');
      const cleanOtp = otp.replace(/\D/g, '');
      
      // Validate OTP format
      if (!this.validateOtp(cleanOtp)) {
        throw new Error('Please enter a valid 6-digit OTP');
      }

      const payload: any = {
        phone: cleanPhone,
        code: cleanOtp, // Backend expects 'code', not 'otp'
      };
      
      // Add name only if provided (for new users)
      if (name && name.trim()) {
        payload.name = name.trim();
      }

      console.log('Verifying OTP with payload:', { ...payload, code: 'HIDDEN' });

      const response = await apiCall('/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.success) {
        throw new Error(response.message || 'OTP verification failed');
      }

      return {
        success: true,
        message: response.message || 'Login successful',
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        user: {
          id: response.data.user.id,
          phone: response.data.user.phone,
          name: response.data.user.name,
          role: response.data.user.role || 'customer',
          tenantId: response.data.user.tenantId,
          isNewUser: response.data.user.isNewUser || false,
          createdAt: response.data.user.createdAt,
        },
      };
    } catch (error: any) {
      console.error('OTP verification failed:', error);
      
      // Handle specific error types
      if (error.message?.includes('expired')) {
        throw new Error('OTP has expired. Please request a new one.');
      }
      
      if (error.message?.includes('invalid') || error.message?.includes('incorrect')) {
        throw new Error('Incorrect OTP. Please check and try again.');
      }
      
      if (error.message?.includes('attempts')) {
        throw new Error('Too many failed attempts. Please request a new OTP.');
      }
      
      throw new Error(
        error?.message || 'OTP verification failed. Please try again.'
      );
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    try {
      const response = await apiCall('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Token refresh failed');
      }
      
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
      if (cleanPhone.length === 0) {
        return {
          isValid: false,
          error: 'Phone number is required',
        };
      }
      
      if (cleanPhone.length !== 10) {
        return {
          isValid: false,
          error: 'Phone number must be 10 digits',
        };
      }

      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return {
          isValid: false,
          error: 'Enter a valid Indian mobile number (must start with 6-9)',
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
        error: 'Phone number must be between 7-15 digits',
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
    return cleanOtp.length === 6 && /^\d{6}$/.test(cleanOtp);
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
    localStorage.removeItem('refresh-token');
  }
}