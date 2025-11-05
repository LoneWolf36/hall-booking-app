/**
 * API Client - Centralized HTTP request handler
 * Handles authentication, error handling, and response parsing
 * 
 * Enhanced with better error handling, logging, and connection recovery
 */

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Normalize: remove trailing slash
const BASE = RAW_BASE.replace(/\/$/, '');

// Debug logging helper
function debugLog(message: string, data?: any) {
  if (process.env.NEXT_PUBLIC_DEBUG_API === 'true') {
    console.log(`[API Client] ${message}`, data || '');
  }
}

function debugError(message: string, error?: any) {
  if (process.env.NEXT_PUBLIC_DEBUG_API === 'true') {
    console.error(`[API Client ERROR] ${message}`, error || '');
  }
}

// Helper to join base + endpoint safely and avoid double /api prefixes
function joinUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.replace(/\/$/, '');
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If base already ends with /api or /api/v1 and endpoint begins with /api (/v1) too, strip the leading /api(/v1)
  try {
    const baseUrl_parsed = new URL(baseUrl);
    const baseEndsWithApi = /\/api(\/v\d+)?$/.test(baseUrl_parsed.pathname);
    if (baseEndsWithApi && /^\/api(\/v\d+)?\//.test(path)) {
      path = path.replace(/^\/api(\/v\d+)?/, '');
    }
  } catch (e) {
    // If URL parsing fails, just continue
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
}

/**
 * Enhanced retry logic for failed requests
 */
async function retryRequest<T>(
  requestFn: () => Promise<Response>,
  maxRetries: number = 2,
  delay: number = 1000
): Promise<Response> {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      debugLog(`Request attempt ${i + 1}/${maxRetries + 1}`);
      const response = await requestFn();
      
      // If we get a response, return it (even if it's an error response)
      if (response) {
        return response;
      }
    } catch (error) {
      lastError = error as Error;
      debugError(`Request attempt ${i + 1} failed:`, error);
      
      // Don't retry on client errors (4xx) or auth errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Network error - retry
        if (i < maxRetries) {
          debugLog(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // Exponential backoff
          continue;
        }
      } else {
        // Don't retry other errors
        throw error;
      }
    }
  }
  
  throw lastError!;
}

/**
 * Make API request with authentication and error handling
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit & { token?: string; retries?: number } = {}
): Promise<ApiResponse<T>> {
  const { token, retries = 2, ...fetchOptions } = options;

  const url = joinUrl(BASE, endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    debugLog('Using provided token');
  } else {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
      debugLog('Using stored token');
    } else {
      debugLog('No authentication token available');
    }
  }

  debugLog(`Making ${fetchOptions.method || 'GET'} request to: ${url}`);
  debugLog('Request headers:', headers);
  
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
    
    let data: any = {};
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
        debugLog('Response data:', data);
      } catch (parseError) {
        debugError('Failed to parse JSON response:', parseError);
        data = { error: 'Invalid JSON response' };
      }
    } else {
      debugLog('Non-JSON response received');
      const text = await response.text();
      data = { message: text || 'No response body' };
    }

    if (!response.ok) {
      const error = new Error(
        data?.message || 
        data?.error || 
        `HTTP ${response.status}: ${response.statusText}`
      ) as ApiError;
      
      error.status = response.status;
      error.data = data;
      error.code = data?.code || `HTTP_${response.status}`;
      
      debugError(`API Error ${response.status}:`, error);
      throw error;
    }

    // Normalize response format
    const apiResponse = data && (typeof data.success === 'boolean' ? data : { success: true, data });
    debugLog('Normalized response:', apiResponse);
    
    return apiResponse;
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      debugError('Re-throwing API error:', error);
      throw error as ApiError;
    }
    
    // Network or other errors
    const apiError = new Error(
      error instanceof Error ? error.message : 'Unknown API error'
    ) as ApiError;
    
    apiError.status = 0; // Network error
    apiError.code = 'NETWORK_ERROR';
    
    // Provide helpful error messages based on error type
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      apiError.message = 'Unable to connect to server. Please check if the backend is running on http://localhost:3000';
      apiError.code = 'CONNECTION_FAILED';
    }
    
    debugError('Network/Unknown error:', apiError);
    throw apiError;
  }
}

// Convenience methods with better error handling
export function apiGet<T = any>(endpoint: string, token?: string, retries?: number) {
  return apiCall<T>(endpoint, { method: 'GET', token, retries });
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
 * Health check function to test API connectivity
 */
export async function checkApiHealth(): Promise<{ healthy: boolean; message: string; latency?: number }> {
  const startTime = performance.now();
  
  try {
    debugLog('Performing API health check...');
    const response = await apiGet('/health', undefined, 0); // No retries for health check
    const latency = Math.round(performance.now() - startTime);
    
    if (response.success) {
      return {
        healthy: true,
        message: 'API is healthy',
        latency
      };
    } else {
      return {
        healthy: false,
        message: response.message || 'API health check failed'
      };
    }
  } catch (error) {
    debugError('Health check failed:', error);
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Health check failed'
    };
  }
}