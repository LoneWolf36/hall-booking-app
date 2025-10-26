export interface CreateBookingDto {
  venueId: string;
  userId: string;
  startTs: string;
  endTs: string;
  eventType?: string;
  guestCount?: number;
  specialRequests?: string;
  idempotencyKey?: string;
}

export interface BookingResponseDto {
  id: string;
  bookingNumber: string;
  status: 'temp_hold' | 'pending' | 'confirmed' | 'cancelled' | 'expired';
  startTs: string;
  endTs: string;
  totalAmountCents?: number;
  currency: string;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
  venue: {
    id: string;
    name: string;
    address?: string;
    basePriceCents: number;
  };
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
}

export interface AvailabilityResponseDto {
  isAvailable: boolean;
  conflictingBookings?: Array<{
    id: string;
    startTs: string;
    endTs: string;
    status: string;
  }>;
  suggestedTimes?: Array<{
    startTs: string;
    endTs: string;
  }>;
}

export interface BookingTimeRangeDto {
  venueId: string;
  startTs: string;
  endTs: string;
}
