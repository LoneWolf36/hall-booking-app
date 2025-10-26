export interface Venue {
  id: string;
  name: string;
  address?: string;
  capacity?: number;
  basePriceCents: number;
  currency: string;
  timeZone: string;
  isActive: boolean;
  paymentProfile: 'cash_only' | 'cash_deposit' | 'hybrid' | 'full_online' | 'marketplace';
  allowCashPayments: boolean;
  cashDiscountPercentage?: number;
  requiresOnlineDeposit: boolean;
  depositAmount: number;
  hasRazorpayAccount: boolean;
}
