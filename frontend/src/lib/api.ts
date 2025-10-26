import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage or cookies
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API service object with proper method definitions
export const api = {
  // Generic HTTP methods
  get: (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
    apiClient.get(url, config),
  
  post: (url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
    apiClient.post(url, data, config),
  
  patch: (url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
    apiClient.patch(url, data, config),
  
  put: (url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
    apiClient.put(url, data, config),
  
  delete: (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> => 
    apiClient.delete(url, config),

  // Health check
  healthCheck: (): Promise<AxiosResponse> => 
    apiClient.get('/health', { baseURL: 'http://localhost:3000' }),
  
  // Bookings
  getBookings: (): Promise<AxiosResponse> => apiClient.get('/bookings'),
  getBooking: (id: string): Promise<AxiosResponse> => apiClient.get(`/bookings/${id}`),
  createBooking: (data: any): Promise<AxiosResponse> => apiClient.post('/bookings', data),
  updateBooking: (id: string, data: any): Promise<AxiosResponse> => 
    apiClient.patch(`/bookings/${id}`, data),
  
  // Users
  getUser: (id: string): Promise<AxiosResponse> => apiClient.get(`/users/${id}`),
  createUser: (data: any): Promise<AxiosResponse> => apiClient.post('/users', data),
  updateUser: (id: string, data: any): Promise<AxiosResponse> => 
    apiClient.patch(`/users/${id}`, data),
  
  // Payments
  getPaymentOptions: (bookingId: string): Promise<AxiosResponse> => 
    apiClient.get(`/payments/bookings/${bookingId}/options`),
  selectPaymentMethod: (bookingId: string, data: any): Promise<AxiosResponse> => 
    apiClient.post(`/payments/bookings/${bookingId}/select-method`, data),
  createPaymentLink: (bookingId: string, data: any): Promise<AxiosResponse> => 
    apiClient.post(`/payments/bookings/${bookingId}/payment-link`, data),
  recordCashPayment: (bookingId: string, data: any): Promise<AxiosResponse> => 
    apiClient.post(`/payments/bookings/${bookingId}/cash-payment`, data),
  
  // Venues
  getVenues: (): Promise<AxiosResponse> => apiClient.get('/venues'),
  getVenue: (id: string): Promise<AxiosResponse> => apiClient.get(`/venues/${id}`),
};

// Export the axios instance as default for backward compatibility
export default apiClient;

// Export types for better TypeScript support
export type { AxiosResponse, AxiosRequestConfig };
