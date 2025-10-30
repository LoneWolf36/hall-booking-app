# API Services Layer

This directory contains all the API service functions that connect the frontend to the backend REST API.

## Structure

- `client.ts` - HTTP client with authentication and error handling
- `bookings.ts` - Booking management endpoints
- `payments.ts` - Payment processing endpoints
- `venues.ts` - Venue information and pricing endpoints
- `index.ts` - Centralized exports

## Usage

### Import API services

```typescript
import { 
  createBooking, 
  getPaymentOptions,
  calculatePricing,
  listVenues 
} from '@/lib/api';
```

### Example: Create a booking

```typescript
const response = await createBooking({
  venueId: 'venue-123',
  eventType: 'wedding',
  guestCount: 100,
  selectedDates: ['2025-11-05', '2025-11-06'],
  startTs: '2025-11-05T00:00:00Z',
  endTs: '2025-11-07T00:00:00Z',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  customerPhone: '+91-9999999999',
  idempotencyKey: 'unique-key-123',
}, authToken);

if (response.success) {
  console.log('Booking created:', response.data);
}
```

### Example: Calculate pricing for dates

```typescript
const pricing = await calculatePricing({
  venueId: 'venue-123',
  selectedDates: ['2025-11-05', '2025-11-06', '2025-11-07'],
  guestCount: 100,
  eventType: 'wedding',
}, authToken);

console.log('Total price:', pricing.data.totalPrice);
console.log('Breakdown:', pricing.data.breakdown);
```

### Example: Get payment options

```typescript
const paymentOptions = await getPaymentOptions(
  'booking-id-123',
  undefined,
  authToken
);

console.log('Available payment methods:', paymentOptions.data.options);
```

## Authentication

All API calls automatically include the JWT token from localStorage if available:

```typescript
const token = localStorage.getItem('auth_token');
const result = await createBooking(bookingData, token);
```

Or the token is retrieved automatically from localStorage:

```typescript
const result = await createBooking(bookingData);
```

## Error Handling

All API functions return `ApiResponse<T>` which includes:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: { page, limit, total, totalPages };
}
```

Errors are thrown as `ApiError`:

```typescript
try {
  const result = await createBooking(data);
} catch (error: ApiError) {
  console.error('API Error:', error.message);
  console.error('Status:', error.status);
  console.error('Data:', error.data);
}
```

## Environment Variables

Set `NEXT_PUBLIC_API_URL` in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Default: `http://localhost:3000/api/v1`

## Available Endpoints

### Bookings

- `createBooking(dto)` - POST /bookings
- `getBooking(id)` - GET /bookings/:id
- `checkAvailability(dto)` - POST /bookings/check-availability
- `getVenueAvailability(venueId)` - GET /bookings/venue/:venueId/availability
- `confirmBooking(id)` - POST /bookings/:id/confirm
- `cancelBooking(id)` - POST /bookings/:id/cancel
- `listBookings(options)` - GET /bookings

### Payments

- `getPaymentOptions(bookingId)` - GET /payments/bookings/:id/options
- `selectPaymentMethod(bookingId, selection)` - POST /payments/bookings/:id/select-method
- `createPaymentLink(bookingId)` - POST /payments/bookings/:id/payment-link
- `recordCashPayment(bookingId, data)` - POST /payments/bookings/:id/cash-payment
- `getCashPaymentSummary(bookingId)` - GET /payments/bookings/:id/cash-summary
- `getVenuePaymentConfig(venueId)` - GET /payments/venues/:id/configuration
- `getCommissionSummary(venueId)` - GET /payments/venues/:id/commission-summary
- `getPaymentHistory(bookingId)` - GET /payments/bookings/:id/history

### Venues

- `listVenues(options)` - GET /venues
- `getVenue(id)` - GET /venues/:id
- `getVenuePricing(id)` - GET /venues/:id/pricing
- `calculatePricing(dto)` - POST /venues/calculate-pricing
- `updateVenuePricing(id, data)` - PATCH /venues/:id/pricing
- `getVenueContacts(id)` - GET /venues/:id/contacts
- `getVenueFurnitureOptions(id)` - GET /venues/:id/furniture
- `addFurnitureOption(id, data)` - POST /venues/:id/furniture
- `updateFurnitureOption(id, furnitureId, data)` - PATCH /venues/:id/furniture/:furnitureId

## Backend API Status

Verify the backend is running:

```bash
cd backend
npm run start:dev
# API available at http://localhost:3000/api/v1
# Swagger docs at http://localhost:3000/api/v1/docs
```
