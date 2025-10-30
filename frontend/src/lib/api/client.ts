/**
 * API Client - Centralized HTTP request handler
 * Handles authentication, error handling, and response parsing
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

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
}

/**
 * Make API request with authentication and error handling
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<ApiResponse<T>> {
  const { token, ...fetchOptions } = options;

  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Try to get token from localStorage
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json() as ApiResponse<T>;

    if (!response.ok) {
      const error = new Error(data.message || `API Error: ${response.status}`) as ApiError;
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      throw error as ApiError;
    }

    const apiError = new Error(error instanceof Error ? error.message : 'Unknown API error') as ApiError;
    apiError.status = 500;
    throw apiError;
  }
}

/**
 * GET request
 */
export function apiGet<T = any>(endpoint: string, token?: string) {
  return apiCall<T>(endpoint, { method: 'GET', token });
}

/**
 * POST request
 */
export function apiPost<T = any>(endpoint: string, body?: any, token?: string) {
  return apiCall<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    token,
  });
}

/**
 * PUT request
 */
export function apiPut<T = any>(endpoint: string, body?: any, token?: string) {
  return apiCall<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    token,
  });
}

/**
 * PATCH request
 */
export function apiPatch<T = any>(endpoint: string, body?: any, token?: string) {
  return apiCall<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
    token,
  });
}

/**
 * DELETE request
 */
export function apiDelete<T = any>(endpoint: string, token?: string) {
  return apiCall<T>(endpoint, {
    method: 'DELETE',
    token,
  });
}
