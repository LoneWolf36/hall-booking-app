/**
 * Authentication Type Definitions
 * 
 * Types for phone-based OTP authentication flow.
 */

/**
 * User role in the system
 */
export type UserRole = 
  | 'customer'
  | 'venue_owner'
  | 'admin'
  | 'support';

/**
 * OTP request payload
 */
export interface RequestOtpDto {
  phone: string;
  countryCode?: string;
}

/**
 * OTP request response
 */
export interface OtpResponseDto {
  success: boolean;
  message: string;
  otpSentTo: string;
  expiresIn: number; // seconds
  retryAfter?: number; // seconds
}

/**
 * OTP verification payload
 */
export interface VerifyOtpDto {
  phone: string;
  otp: string;
  name?: string; // For new user registration
}

/**
 * Login response with JWT tokens
 */
export interface LoginResponseDto {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  user: {
    id: string;
    phone: string;
    name: string;
    email?: string;
    role: UserRole;
    isNewUser: boolean;
  };
}

/**
 * JWT token payload (decoded)
 */
export interface JwtPayload {
  sub: string; // user ID
  phone: string;
  role: UserRole;
  tenantId: string;
  iat: number; // issued at
  exp: number; // expiration
}

/**
 * Refresh token request
 */
export interface RefreshTokenDto {
  refreshToken: string;
}

/**
 * Refresh token response
 */
export interface RefreshTokenResponseDto {
  accessToken: string;
  expiresIn: number;
}

/**
 * Current user from JWT (for auth guard)
 */
export interface RequestUser {
  userId: string;
  phone: string;
  role: UserRole;
  tenantId: string;
}

/**
 * Auth state for UI
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: LoginResponseDto['user'] | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Phone number validation result
 */
export interface PhoneValidation {
  isValid: boolean;
  formatted?: string;
  error?: string;
}

/**
 * OTP input state
 */
export interface OtpInputState {
  value: string;
  isComplete: boolean;
  isVerifying: boolean;
  error?: string;
}
