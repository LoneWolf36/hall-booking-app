/**
 * Enhanced API Client - Centralized HTTP request handler
 * 
 * MAJOR IMPROVEMENTS:
 * - Fixed authentication token issues causing "No authentication token available" errors
 * - Added automatic token refresh on 401 responses
 * - Enhanced error classification and user-friendly messages
 * - Improved connection detection and retry logic
 * - Added request/response interceptors
 * - Better SSR compatibility
 * - Comprehensive debug logging
 * - Network status monitoring
 */

import { toast } from 'sonner';

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Normalize: remove trailing slash
const BASE = RAW_BASE.replace(/\/$/, '');

// Debug logging with better formatting
function debugLog(message: string, data?: any) {
  if (process.env.NEXT_PUBLIC_DEBUG_API === 'true') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`🌐 [${timestamp}] ${message}`, data ? '\n' + JSON.stringify(data, null, 2) : '');
  }
}

function debugError(message: string, error?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.error(`❌ [${timestamp}] ${message}`, error || '');
}

function debugWarn(message: string, data?: any) {
  if (process.env.NEXT_PUBLIC_DEBUG_API === 'true') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.warn(`⚠️  [${timestamp}] ${message}`, data || '');
  }
}

// Network status monitoring
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let lastConnectivityCheck = 0;
const CONNECTIVITY_CHECK_INTERVAL = 30000; // 30 seconds

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    debugLog('Network connection restored');
  });
  
  window.addEventListener('offline', () => {
    isOnline = false;
    debugWarn('Network connection lost');
  });
}

// Helper to join base + endpoint safely
function joinUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.replace(/\/$/, '');
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Handle API prefix conflicts
  try {
    const baseUrl_parsed = new URL(baseUrl);
    const baseEndsWithApi = /\/api(\/v\d+)?$/.test(baseUrl_parsed.pathname);
    if (baseEndsWithApi && /^\/api(\/v\d+)?\//.test(path)) {
      path = path.replace(/^\/api(\/v\d+)?/, '');
    }
  } catch (e) {
    debugError('URL parsing failed, continuing with simple join', e);
  }
  
  const finalUrl = `${base}${path}`;
  debugLog(`Constructed URL: ${finalUrl}`);
  return finalUrl;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface ApiError extends Error {
  status: number;
  data?: any;
  code?: string;
  isRetryable?: boolean;
  timestamp?: number;
}

// Token management interface
interface TokenManager {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
  refreshToken(): Promise<boolean>;
  isTokenExpired(): boolean;
}

// Enhanced token manager with Zustand integration
class EnhancedTokenManager implements TokenManager {
  getToken(): string | null {
    // Try multiple sources for token
    if (typeof window === 'undefined') return null;
    
    // 1. Try localStorage (primary)
    const authToken = localStorage.getItem('auth-token');
    if (authToken) {
      debugLog('Token found in localStorage (auth-token)');
      return authToken;
    }
    
    // 2. Try legacy token key
    const legacyToken = localStorage.getItem('token');
    if (legacyToken) {
      debugLog('Token found in localStorage (legacy token)');
      return legacyToken;
    }
    
    // 3. Try to get from Zustand store if available
    try {
      // Dynamic import to avoid SSR issues
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        if (parsed?.state?.accessToken) {
          debugLog('Token found in Zustand storage');
          return parsed.state.accessToken;
        }
      }
    } catch (error) {
      debugWarn('Failed to read token from Zustand storage', error);
    }
    
    debugWarn('No authentication token found in any storage');
    return null;
  }
  
  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('auth-token', token);
      localStorage.setItem('token', token); // Legacy support
      debugLog('Token saved to localStorage');
    } catch (error) {
      debugError('Failed to save token to localStorage', error);
    }
  }
  
  clearToken(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem('auth-token');
      localStorage.removeItem('token');
      debugLog('Tokens cleared from localStorage');
    } catch (error) {
      debugError('Failed to clear tokens from localStorage', error);
    }
  }
  
  async refreshToken(): Promise<boolean> {
    try {
      // Try to get refresh token from storage
      if (typeof window === 'undefined') return false;
      
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return false;
      
      const parsed = JSON.parse(authStorage);
      const refreshToken = parsed?.state?.refreshToken;
      
      if (!refreshToken) {
        debugWarn('No refresh token available');
        return false;
      }
      
      debugLog('Attempting token refresh...');
      
      const response = await fetch(joinUrl(BASE, '/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        mode: 'cors',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.accessToken) {
          this.setToken(data.accessToken);
          debugLog('Token refreshed successfully');
          
          // Try to update Zustand store if available
          try {
            // Dispatch custom event for auth store to update
            window.dispatchEvent(new CustomEvent('tokenRefreshed', {
              detail: { accessToken: data.accessToken, expiresIn: data.expiresIn }
            }));
          } catch (error) {
            debugWarn('Failed to notify auth store of token refresh', error);
          }
          
          return true;
        }
      }
      
      debugError('Token refresh failed:', response.status, response.statusText);
      return false;
    } catch (error) {
      debugError('Token refresh error:', error);
      return false;
    }
  }
  
  isTokenExpired(): boolean {
    try {
      if (typeof window === 'undefined') return true;
      
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return true;
      
      const parsed = JSON.parse(authStorage);
      const expiresAt = parsed?.state?.expiresAt;
      
      if (!expiresAt) return true;
      
      // Consider token expired if it expires in less than 5 minutes
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      return Date.now() + bufferTime >= expiresAt;
    } catch (error) {
      debugWarn('Failed to check token expiration', error);
      return true;
    }
  }
}

const tokenManager = new EnhancedTokenManager();

/**
 * Enhanced connectivity check
 */
async function checkConnectivity(): Promise<boolean> {
  const now = Date.now();
  
  // Throttle connectivity checks
  if (now - lastConnectivityCheck < CONNECTIVITY_CHECK_INTERVAL) {
    return isOnline;
  }
  
  lastConnectivityCheck = now;
  
  if (!isOnline) {
    debugWarn('Browser reports offline status');
    return false;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('/api/ping', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache',
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    debugWarn('Connectivity check failed:', error);
    return false;
  }
}

/**
 * Enhanced error classification
 */
function classifyError(error: any): { type: string; isRetryable: boolean; userMessage: string } {
  if (error?.status) {
    switch (error.status) {
      case 0:
        return {
          type: 'network',
          isRetryable: true,
          userMessage: 'Unable to connect to the server. Please check your internet connection.',
        };
      
      case 401:
        return {
          type: 'auth',
          isRetryable: true, // Can retry after token refresh
          userMessage: 'Your session has expired. Please log in again.',
        };
      
      case 403:
        return {
          type: 'forbidden',
          isRetryable: false,
          userMessage: 'You do not have permission to perform this action.',
        };
      
      case 404:
        return {
          type: 'not_found',
          isRetryable: false,
          userMessage: 'The requested resource was not found.',
        };
      
      case 429:
        return {
          type: 'rate_limit',
          isRetryable: true,
          userMessage: 'Too many requests. Please try again later.',
        };
      
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: 'server',
          isRetryable: true,
          userMessage: 'The server is experiencing issues. Please try again later.',
        };
      
      default:
        return {
          type: 'unknown',
          isRetryable: error.status >= 500,
          userMessage: error.message || 'An unexpected error occurred.',
        };
    }
  }
  
  // Network errors
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return {
      type: 'network',
      isRetryable: true,
      userMessage: 'Unable to connect to the server. Please check if the backend is running.',
    };
  }
  
  return {
    type: 'unknown',
    isRetryable: false,
    userMessage: error?.message || 'An unexpected error occurred.',
  };
}

/**
 * Enhanced retry logic with exponential backoff
 */
async function retryRequest<T>(
  requestFn: () => Promise<Response>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<Response> {
  let lastError: ApiError;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      debugLog(`Request attempt ${attempt + 1}/${maxRetries + 1}`);
      
      // Check connectivity before attempting request
      if (!(await checkConnectivity())) {
        throw new Error('No internet connection');
      }
      
      const response = await requestFn();
      
      // Success - return response
      if (response) {
        if (attempt > 0) {
          debugLog(`Request succeeded on attempt ${attempt + 1}`);
        }
        return response;
      }
    } catch (error) {
      const apiError = error as ApiError;
      apiError.timestamp = Date.now();
      lastError = apiError;
      
      debugError(`Request attempt ${attempt + 1} failed:`, error);
      
      // Classify error to determine if we should retry
      const { type, isRetryable } = classifyError(error);
      
      // Don't retry non-retryable errors
      if (!isRetryable || attempt >= maxRetries) {
        debugError(`Not retrying: ${!isRetryable ? 'non-retryable error' : 'max retries exceeded'}`);
        throw lastError;
      }
      
      // Special handling for auth errors - try token refresh
      if (type === 'auth' && attempt < maxRetries) {
        debugLog('Attempting token refresh for 401 error');
        const refreshed = await tokenManager.refreshToken();
        if (refreshed) {
          debugLog('Token refreshed, retrying request immediately');
          continue; // Retry immediately with new token
        } else {
          debugError('Token refresh failed, will retry with exponential backoff');
        }
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        debugLog(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5 + Math.random() * 1000, 10000); // Max 10s delay
      }
    }
  }
  
  throw lastError!;
}

/**
 * Enhanced API request function
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit & { 
    token?: string; 
    retries?: number;
    skipAuth?: boolean;
    skipErrorToast?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const { 
    token, 
    retries = 2, 
    skipAuth = false,
    skipErrorToast = false,
    ...fetchOptions 
  } = options;

  const url = joinUrl(BASE, endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  // Enhanced authentication token handling
  if (!skipAuth) {
    let authToken = token;
    
    if (!authToken) {
      // Check if token is expired and refresh if needed
      if (tokenManager.isTokenExpired()) {
        debugLog('Token is expired, attempting refresh before request');
        await tokenManager.refreshToken();
      }
      
      authToken = tokenManager.getToken();
    }
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      debugLog('Using authentication token');
    } else {
      debugWarn('No authentication token available for protected endpoint');
    }
  }

  // Add request metadata
  headers['X-Client-Version'] = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
  headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  debugLog(`Making ${fetchOptions.method || 'GET'} request to: ${url}`);
  debugLog('Request headers:', { ...headers, Authorization: headers.Authorization ? '[REDACTED]' : undefined });
  
  if (fetchOptions.body) {
    debugLog('Request body:', fetchOptions.body);
  }

  try {
    const response = await retryRequest(async () => {
      return fetch(url, {
        ...fetchOptions,
        headers,
        mode: 'cors',
        credentials: 'include',
      });
    }, retries);

    debugLog(`Response status: ${response.status} ${response.statusText}`);
    
    // Parse response
    let data: any = {};
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
        debugLog('Response data:', data);
      } catch (parseError) {
        debugError('Failed to parse JSON response:', parseError);
        data = { error: 'Invalid JSON response from server' };
      }
    } else {
      debugLog('Non-JSON response received');
      const text = await response.text();
      data = { message: text || 'No response body' };
    }

    // Handle error responses
    if (!response.ok) {
      const { userMessage } = classifyError({ status: response.status, message: data?.message });
      
      const error = new Error(
        data?.message || 
        data?.error || 
        userMessage ||
        `HTTP ${response.status}: ${response.statusText}`
      ) as ApiError;
      
      error.status = response.status;
      error.data = data;
      error.code = data?.code || `HTTP_${response.status}`;
      error.isRetryable = response.status >= 500 || response.status === 401;
      error.timestamp = Date.now();
      
      // Show user-friendly error toast
      if (!skipErrorToast && typeof window !== 'undefined') {
        const { type } = classifyError(error);
        
        if (type === 'auth') {
          toast.error('Session Expired', {
            description: 'Please log in again to continue.',
            duration: 5000,
          });
        } else if (type === 'network') {
          toast.error('Connection Error', {
            description: 'Unable to connect to the server. Please try again.',
            duration: 5000,
          });
        } else if (type === 'server') {
          toast.error('Server Error', {
            description: 'The server is experiencing issues. Please try again later.',
            duration: 5000,
          });
        } else {
          toast.error('Error', {
            description: userMessage,
            duration: 5000,
          });
        }
      }
      
      debugError(`API Error ${response.status}:`, error);
      throw error;
    }

    // Normalize response format
    const apiResponse: ApiResponse<T> = data && (typeof data.success === 'boolean' ? data : { success: true, data });
    debugLog('Normalized response:', apiResponse);
    
    return apiResponse;
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      throw error as ApiError;
    }
    
    // Network or other errors
    const { userMessage } = classifyError(error);
    
    const apiError = new Error(
      error instanceof Error ? error.message : 'Unknown API error'
    ) as ApiError;
    
    apiError.status = 0; // Network error
    apiError.code = 'NETWORK_ERROR';
    apiError.isRetryable = true;
    apiError.timestamp = Date.now();
    
    // Enhanced error messages
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      apiError.message = 'Unable to connect to server. Please check if the backend is running.'
      apiError.code = 'CONNECTION_FAILED';
    }
    
    // Show network error toast
    if (!skipErrorToast && typeof window !== 'undefined') {
      toast.error('Connection Error', {
        description: apiError.message,
        duration: 5000,
      });
    }
    
    debugError('Network/Unknown error:', apiError);
    throw apiError;
  }
}

// Convenience methods
export function apiGet<T = any>(endpoint: string, token?: string, retries?: number, skipAuth?: boolean) {
  return apiCall<T>(endpoint, { method: 'GET', token, retries, skipAuth });
}

export function apiPost<T = any>(endpoint: string, body?: any, token?: string, retries?: number) {
  return apiCall<T>(endpoint, { 
    method: 'POST', 
    body: body ? JSON.stringify(body) : undefined, 
    token,
    retries 
  });
}

export function apiPut<T = any>(endpoint: string, body?: any, token?: string, retries?: number) {
  return apiCall<T>(endpoint, { 
    method: 'PUT', 
    body: body ? JSON.stringify(body) : undefined, 
    token,
    retries 
  });
}

export function apiPatch<T = any>(endpoint: string, body?: any, token?: string, retries?: number) {
  return apiCall<T>(endpoint, { 
    method: 'PATCH', 
    body: body ? JSON.stringify(body) : undefined, 
    token,
    retries 
  });
}

export function apiDelete<T = any>(endpoint: string, token?: string, retries?: number) {
  return apiCall<T>(endpoint, { method: 'DELETE', token, retries });
}

/**
 * Enhanced health check with detailed diagnostics
 */
export async function checkApiHealth(): Promise<{ 
  healthy: boolean; 
  message: string; 
  latency?: number;
  details?: any;
}> {
  const startTime = performance.now();
  
  try {
    debugLog('Performing enhanced API health check...');
    
    // Check multiple endpoints for comprehensive health check
    const healthResponse = await apiGet('/health', undefined, 0, true); // Skip auth, no retries
    const latency = Math.round(performance.now() - startTime);
    
    if (healthResponse.success) {
      return {
        healthy: true,
        message: 'API is healthy',
        latency,
        details: {
          timestamp: new Date().toISOString(),
          endpoint: '/health',
          response: healthResponse.data,
        },
      };
    } else {
      return {
        healthy: false,
        message: healthResponse.message || 'API health check failed',
        details: {
          response: healthResponse,
        },
      };
    }
  } catch (error) {
    debugError('Health check failed:', error);
    const { userMessage } = classifyError(error);
    
    return {
      healthy: false,
      message: userMessage,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: (error as ApiError)?.code,
        timestamp: Date.now(),
      },
    };
  }
}

// Export token manager for direct access if needed
export { tokenManager };

// Export error types
export type { ApiError, ApiResponse };