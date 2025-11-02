/**
 * API Client - Centralized HTTP request handler
 * Handles authentication, error handling, and response parsing
 *
 * Update: Prevent double /api or /api/v1 prefix when NEXT_PUBLIC_API_URL already includes it.
 */

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Normalize: remove trailing slash
const BASE = RAW_BASE.replace(/\/$/, '');

// Helper to join base + endpoint safely and avoid double /api prefixes
function joinUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.replace(/\/$/, '');
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If base already ends with /api or /api/v1 and endpoint begins with /api (/v1) too, strip the leading /api(/v1)
  const baseEndsWithApi = /\/api(\/v\d+)?$/.test(new URL(baseUrl).pathname);
  if (baseEndsWithApi && /^\/api(\/v\d+)?\//.test(path)) {
    path = path.replace(/^\/api(\/v\d+)?/, '');
  }
  return `${base}${path}`;
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
}

/**
 * Make API request with authentication and error handling
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<ApiResponse<T>> {
  const { token, ...fetchOptions } = options;

  const url = joinUrl(BASE, endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      mode: 'cors',
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({})) as ApiResponse<T>;

    if (!response.ok) {
      const error = new Error(data?.message || `API Error: ${response.status}`) as ApiError;
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data && (typeof data.success === 'boolean' ? data : { success: true, data });
  } catch (error) {
    if (error instanceof Error && 'status' in error) throw error as ApiError;
    const apiError = new Error(error instanceof Error ? error.message : 'Unknown API error') as ApiError;
    apiError.status = 500;
    throw apiError;
  }
}

export function apiGet<T = any>(endpoint: string, token?: string) { return apiCall<T>(endpoint, { method: 'GET', token }); }
export function apiPost<T = any>(endpoint: string, body?: any, token?: string) { return apiCall<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined, token }); }
export function apiPut<T = any>(endpoint: string, body?: any, token?: string) { return apiCall<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, token }); }
export function apiPatch<T = any>(endpoint: string, body?: any, token?: string) { return apiCall<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, token }); }
export function apiDelete<T = any>(endpoint: string, token?: string) { return apiCall<T>(endpoint, { method: 'DELETE', token }); }
