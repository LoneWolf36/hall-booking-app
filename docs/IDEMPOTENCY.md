# Idempotency Implementation Guide

## Overview

This document explains the comprehensive idempotency system implemented in the hall booking application. Idempotency ensures that duplicate requests (caused by network issues, user double-clicks, or system retries) produce the same result without harmful side effects.

## Why Idempotency Matters

### Common Scenarios Requiring Idempotency
1. **Network Timeouts**: Client doesn't receive response, retries request
2. **User Double-Clicks**: User clicks "Book Now" multiple times
3. **Mobile App Retries**: Automatic retry logic in mobile applications
4. **Payment Gateway Webhooks**: Payment providers may send duplicate notifications
5. **Load Balancer Issues**: Request forwarded to multiple servers

### Business Impact Without Idempotency
- **Double Bookings**: Same hall booked twice for same time slot
- **Duplicate Charges**: Customer charged multiple times
- **Inventory Issues**: Venue capacity miscalculated
- **Customer Frustration**: Unexpected duplicate transactions

## Implementation Architecture

### Core Components

```
┌─────────────────────┐
│   HTTP Request      │
│ X-Idempotency-Key   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ IdempotencyInterceptor │
│ - Validates UUID    │
│ - Checks Redis Cache│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    Redis Cache      │
│ - 24h TTL          │
│ - JSON Response    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Business Logic     │
│ - Process Request  │
│ - Generate Response│
└─────────────────────┘
```

### File Structure
```
src/common/
├── interceptors/
│   ├── idempotency.interceptor.ts       # Core interceptor logic
│   └── idempotency.interceptor.spec.ts  # Comprehensive tests
├── decorators/
│   └── idempotent.decorator.ts          # Easy-to-use decorators
└── services/
    └── error-handler.service.ts         # Enhanced error handling
```

## Usage Guide

### 1. Apply Idempotency to Controllers

#### Critical Operations (Required Idempotency)
```typescript
import { RequireIdempotency } from '../common/decorators/idempotent.decorator';

@Post('bookings')
@RequireIdempotency()  // Idempotency key REQUIRED
async createBooking(
  @Body() createBookingDto: CreateBookingDto,
  @Headers('x-idempotency-key') idempotencyKey: string,
) {
  return await this.bookingsService.createBooking(createBookingDto);
}
```

#### Optional Operations (Performance Benefit)
```typescript
import { OptionalIdempotency } from '../common/decorators/idempotent.decorator';

@Post('check-availability')
@OptionalIdempotency()  // Idempotency key optional, helps with caching
async checkAvailability(
  @Body() timeRangeDto: BookingTimeRangeDto,
) {
  return await this.bookingsService.checkAvailability(timeRangeDto);
}
```

### 2. Client Implementation

#### Web Frontend (JavaScript)
```javascript
const { v4: uuidv4 } = require('uuid');

// Generate unique key per user action
const createBooking = async (bookingData) => {
  const idempotencyKey = uuidv4();
  
  const response = await fetch('/api/v1/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-Tenant-Id': 'your-tenant-id'
    },
    body: JSON.stringify(bookingData)
  });
  
  return response.json();
};
```

#### Mobile App (React Native)
```javascript
import { nanoid } from 'nanoid';

const BookingForm = () => {
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => nanoid()); // Generate once per form
  
  const handleSubmit = async (data) => {
    if (submitting) return; // Prevent double submission
    
    setSubmitting(true);
    try {
      await createBooking(data, idempotencyKey);
    } finally {
      setSubmitting(false);
    }
  };
};
```

#### cURL Example
```bash
curl -X POST https://api.example.com/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "X-Tenant-Id: tenant-uuid" \
  -d '{
    "venueId": "venue-uuid",
    "customer": {
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com"
    },
    "startTs": "2025-12-25T10:00:00.000Z",
    "endTs": "2025-12-25T18:00:00.000Z",
    "eventType": "wedding",
    "guestCount": 200
  }'
```

## Response Handling

### Success Responses

#### First Request (201 Created)
```json
{
  "success": true,
  "booking": {
    "id": "booking-uuid",
    "bookingNumber": "PBH-2025-0001",
    "status": "temp_hold",
    "...": "..."
  },
  "isNewCustomer": true,
  "holdExpiresIn": 15
}
```

#### Duplicate Request (200 OK - Cached)
```json
{
  "success": true,
  "booking": {
    "id": "booking-uuid",
    "bookingNumber": "PBH-2025-0001",
    "status": "temp_hold",
    "...": "..."
  },
  "isNewCustomer": true,
  "holdExpiresIn": 12
}
```

### Error Responses

#### Invalid Idempotency Key (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "X-Idempotency-Key must be a valid UUID",
  "error": "Bad Request"
}
```

#### Missing Required Key (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "X-Idempotency-Key header is required for this operation",
  "error": "Bad Request"
}
```

## Best Practices

### 1. Key Generation Strategy

#### ✅ Good Practices
- Generate UUID v4 per user action/form submission
- Store key in form state until successful completion
- Use consistent key for retries of same action
- Include action context in logs for debugging

#### ❌ Avoid
- Reusing keys across different operations
- Using predictable patterns (timestamps, sequences)
- Generating new key on every retry
- Using sensitive data in keys

### 2. Cache Management

#### TTL Strategy
- **Default**: 24 hours for most operations
- **Payments**: 48 hours (longer retention for financial operations)
- **Quick Actions**: 1 hour (availability checks, searches)

#### Cache Keys
```
idempotency:{uuid}                    # Standard format
idempotency:550e8400-e29b-41d4-...   # Example
```

### 3. Error Handling

#### Client-Side
```javascript
const handleResponse = async (response) => {
  if (response.status === 400) {
    const error = await response.json();
    if (error.message.includes('idempotency')) {
      // Regenerate key and retry
      return retryWithNewKey();
    }
  }
  
  if (response.status === 409) {
    // Conflict - request processed differently
    // This shouldn't happen with proper idempotency
    throw new Error('Request conflict detected');
  }
  
  return response.json();
};
```

#### Server-Side Monitoring
```typescript
// Log idempotency cache hits for monitoring
this.logger.log('Idempotency cache hit', {
  key: idempotencyKey,
  endpoint: request.url,
  method: request.method,
  userId: request.user?.id,
});
```

## Monitoring & Debugging

### Key Metrics
1. **Cache Hit Rate**: % of requests served from cache
2. **Key Validation Errors**: Invalid UUID format requests
3. **Redis Performance**: Cache operation latency
4. **Duplicate Detection**: Actual duplicate request prevention

### Logging Strategy

#### Success Logs
```
[IdempotencyInterceptor] Cached response for key: 550e8400-...
[IdempotencyInterceptor] Processing new request with key: 550e8400-...
```

#### Error Logs
```
[IdempotencyInterceptor] Invalid UUID format: invalid-key
[IdempotencyInterceptor] Redis error (continuing without cache): Connection failed
```

### Debug Tools

#### Redis CLI Commands
```bash
# Check cached response
GET idempotency:550e8400-e29b-41d4-a716-446655440000

# List all idempotency keys
KEYS idempotency:*

# Check TTL
TTL idempotency:550e8400-e29b-41d4-a716-446655440000
```

## Testing

### Unit Tests
```bash
# Run idempotency interceptor tests
npm test -- idempotency.interceptor.spec.ts

# Run with coverage
npm run test:cov -- idempotency.interceptor.spec.ts
```

### Integration Tests
```javascript
describe('Booking Creation Idempotency', () => {
  it('should return same booking for duplicate requests', async () => {
    const idempotencyKey = uuid();
    const bookingData = { /* ... */ };
    
    // First request
    const response1 = await request(app)
      .post('/api/v1/bookings')
      .set('X-Idempotency-Key', idempotencyKey)
      .send(bookingData);
    
    // Duplicate request
    const response2 = await request(app)
      .post('/api/v1/bookings')
      .set('X-Idempotency-Key', idempotencyKey)
      .send(bookingData);
    
    expect(response1.body.booking.id).toBe(response2.body.booking.id);
  });
});
```

### Load Testing
```javascript
// Test concurrent requests with same idempotency key
const concurrentRequests = Array.from({ length: 10 }, () => 
  createBooking(bookingData, sameIdempotencyKey)
);

const results = await Promise.all(concurrentRequests);
// All should return same booking ID
```

## Troubleshooting

### Common Issues

#### 1. "Idempotency key required" Error
**Cause**: Missing `X-Idempotency-Key` header on critical endpoint
**Solution**: Add header with valid UUID v4

#### 2. Redis Connection Failures
**Cause**: Redis server unavailable
**Impact**: System continues without caching (graceful degradation)
**Monitoring**: Check Redis connectivity and error logs

#### 3. Inconsistent Responses
**Cause**: Processing different data with same idempotency key
**Prevention**: Use unique keys per unique operation

#### 4. Cache Misses on Valid Keys
**Cause**: Redis restart, TTL expiration, or memory pressure
**Impact**: Request processed again (safe but less efficient)

### Performance Considerations

#### Redis Memory Usage
- Each cached response: ~1-5KB depending on booking size
- 1M requests/day ≈ 1-5GB Redis memory
- Use Redis eviction policies for memory management

#### Response Time Impact
- Cache hit: ~1-2ms additional latency
- Cache miss: ~3-5ms additional latency
- Network timeout handling prevents hanging requests

## Security Considerations

### Key Security
- UUIDs are cryptographically random (non-guessable)
- Keys don't expose sensitive information
- TTL ensures automatic cleanup

### Access Control
- Idempotency works within tenant boundaries
- Redis keys include tenant context where needed
- No cross-tenant key sharing

### Data Protection
- Cached responses don't include sensitive payment data
- PII in cache respects data retention policies
- Cache encryption available for sensitive data

---

## Summary

The idempotency system provides:

✅ **Reliability**: Prevents duplicate operations  
✅ **Performance**: Caches responses for quick retrieval  
✅ **Flexibility**: Easy decorator-based configuration  
✅ **Monitoring**: Comprehensive logging and metrics  
✅ **Resilience**: Graceful degradation when Redis fails  
✅ **Security**: Safe key generation and tenant isolation  

For questions or issues, refer to the test files for detailed usage examples or contact the development team.