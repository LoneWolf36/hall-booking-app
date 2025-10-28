/**
 * Payment Service
 * 
 * Handles payment-related operations including method selection,
 * payment link generation, and cash payment recording.
 */

import { api } from '@/lib/api';
import type {
  PaymentOptions,
  PaymentMethodSelection,
  PaymentLinkResponse,
  CashPaymentRecord,
  PaymentTransaction,
  PriceBreakdown,
} from '@/types/payment';

/**
 * Payment service class
 */
export class PaymentService {
  /**
   * Get available payment options for a booking
   */
  static async getPaymentOptions(bookingId: string): Promise<PaymentOptions> {
    try {
      const response = await api.get(`/payments/bookings/${bookingId}/options`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch payment options:', error);
      throw new Error(
        error?.response?.data?.message || 'Failed to load payment options'
      );
    }
  }

  /**
   * Select payment method for booking
   */
  static async selectPaymentMethod(
    bookingId: string,
    selection: Omit<PaymentMethodSelection, 'bookingId'>
  ): Promise<void> {
    try {
      await api.post(`/payments/bookings/${bookingId}/select-method`, selection);
    } catch (error: any) {
      console.error('Failed to select payment method:', error);
      throw new Error(
        error?.response?.data?.message || 'Failed to select payment method'
      );
    }
  }

  /**
   * Create Razorpay payment link
   */
  static async createPaymentLink(
    bookingId: string,
    data: {
      amount: number;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
    }
  ): Promise<PaymentLinkResponse> {
    try {
      const response = await api.post(`/payments/bookings/${bookingId}/payment-link`, data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create payment link:', error);
      throw new Error(
        error?.response?.data?.message || 'Failed to create payment link'
      );
    }
  }

  /**
   * Record cash payment
   */
  static async recordCashPayment(
    bookingId: string,
    data: Omit<CashPaymentRecord, 'bookingId'>
  ): Promise<PaymentTransaction> {
    try {
      const response = await api.post(`/payments/bookings/${bookingId}/cash-payment`, data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to record cash payment:', error);
      throw new Error(
        error?.response?.data?.message || 'Failed to record cash payment'
      );
    }
  }

  /**
   * Calculate price breakdown
   */
  static calculatePriceBreakdown(
    basePrice: number,
    addonsTotal: number = 0,
    platformFeePercentage: number = 0.08,
    discountAmount: number = 0,
    taxRate: number = 0.18
  ): PriceBreakdown {
    const subtotal = basePrice + addonsTotal;
    const tax = subtotal * taxRate;
    const platformFee = subtotal * platformFeePercentage;
    const total = subtotal + tax + platformFee - discountAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      addons: Math.round(addonsTotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      discount: Math.round(discountAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      currency: 'INR',
      items: [
        {
          label: 'Base Price',
          amount: basePrice,
          description: 'Venue booking base price',
        },
        ...(addonsTotal > 0
          ? [
              {
                label: 'Add-ons',
                amount: addonsTotal,
                description: 'Additional services',
              },
            ]
          : []),
        {
          label: 'Tax (GST 18%)',
          amount: tax,
          description: 'Goods and Services Tax',
        },
        {
          label: `Platform Fee (${(platformFeePercentage * 100).toFixed(0)}%)`,
          amount: platformFee,
          description: 'Service and maintenance fee',
        },
        ...(discountAmount > 0
          ? [
              {
                label: 'Discount',
                amount: -discountAmount,
                description: 'Applied discount',
              },
            ]
          : []),
      ],
    };
  }

  /**
   * Format currency amount
   */
  static formatCurrency(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Calculate cash discount
   */
  static calculateCashDiscount(amount: number, discountPercentage: number): number {
    return Math.round(amount * (discountPercentage / 100) * 100) / 100;
  }

  /**
   * Open Razorpay checkout (client-side)
   */
  static async openRazorpayCheckout(
    options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      orderId: string;
      prefill: {
        name: string;
        phone: string;
        email?: string;
      };
      notes?: Record<string, string>;
      theme?: {
        color: string;
      };
    },
    onSuccess: (response: any) => void,
    onFailure: (error: any) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Razorpay can only be used in browser'));
        return;
      }

      // Check if Razorpay is loaded
      if (!(window as any).Razorpay) {
        reject(new Error('Razorpay SDK not loaded'));
        return;
      }

      const rzp = new (window as any).Razorpay({
        ...options,
        handler: (response: any) => {
          onSuccess(response);
          resolve();
        },
        modal: {
          ondismiss: () => {
            onFailure(new Error('Payment cancelled by user'));
            resolve();
          },
        },
      });

      rzp.on('payment.failed', (response: any) => {
        onFailure(response.error);
        resolve();
      });

      rzp.open();
    });
  }

  /**
   * Verify payment signature (to be called on backend)
   */
  static async verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): Promise<boolean> {
    try {
      const response = await api.post('/payments/verify-signature', {
        orderId,
        paymentId,
        signature,
      });
      return response.data.verified;
    } catch (error: any) {
      console.error('Payment verification failed:', error);
      return false;
    }
  }
}
