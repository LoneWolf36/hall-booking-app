import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

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

export default apiClient;

// API service methods
export const api = {
  // Health check
  healthCheck: () => apiClient.get('/health', { baseURL: 'http://localhost:3000' }),
  
  // Bookings
  getBookings: () => apiClient.get('/bookings'),
  getBooking: (id: string) => apiClient.get(`/bookings/${id}`),
  createBooking: (data: any) => apiClient.post('/bookings', data),
  updateBooking: (id: string, data: any) => apiClient.patch(`/bookings/${id}`, data),
  
  // Users
  getUser: (id: string) => apiClient.get(`/users/${id}`),
  createUser: (data: any) => apiClient.post('/users', data),
  updateUser: (id: string, data: any) => apiClient.patch(`/users/${id}`, data),
  
  // Payments
  getPaymentOptions: (bookingId: string) => apiClient.get(`/payments/bookings/${bookingId}/options`),
  selectPaymentMethod: (bookingId: string, data: any) => apiClient.post(`/payments/bookings/${bookingId}/select-method`, data),
  createPaymentLink: (bookingId: string, data: any) => apiClient.post(`/payments/bookings/${bookingId}/payment-link`, data),
  recordCashPayment: (bookingId: string, data: any) => apiClient.post(`/payments/bookings/${bookingId}/cash-payment`, data),
  
  // Venues (for future use)
  getVenues: () => apiClient.get('/venues'),
  getVenue: (id: string) => apiClient.get(`/venues/${id}`),
};
