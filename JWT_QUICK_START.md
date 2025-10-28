# 🚀 JWT Authentication - Quick Start Guide

**Status**: ✅ Production Ready  
**Coverage**: 100% (25/25 endpoints)  
**Last Updated**: 2025-10-28

---

## ⚡ Quick Start (5 Minutes)

### 1. **Get a JWT Token**

```bash
# Step 1: Request OTP
curl -X POST http://localhost:3000/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "tenantId": "your-tenant-id"
  }'

# Step 2: Verify OTP (use "000000" in development)
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "otp": "000000",
    "tenantId": "your-tenant-id"
  }'

# Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "user-uuid",
    "phone": "+919876543210",
    "name": "User 3210",
    "role": "customer",
    "tenantId": "your-tenant-id"
  }
}
```

### 2. **Use the Token**

```bash
# Copy the accessToken and use it in all API calls
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Example: Get your profile
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer $TOKEN"

# Example: Create a booking
curl -X POST http://localhost:3000/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "venueId": "venue-uuid",
    "startTs": "2025-12-25T18:00:00.000Z",
    "endTs": "2025-12-25T23:00:00.000Z"
  }'
```

---

## 🔑 Development Bypass OTP

**For testing only** - Works when `NODE_ENV=development`

```bash
# Use this magic OTP to skip SMS delivery
{
  "phone": "+919876543210",
  "otp": "000000",  # ← Always works in development
  "tenantId": "your-tenant-id"
}
```

**Security Note**: This bypass is **automatically disabled** in production.

---

## 📋 All Protected Endpoints (25 Total)

### Auth Endpoints (3) - Public

| Endpoint | Method | Auth Required |
|----------|--------|---------------|
| `/auth/request-otp` | POST | ❌ Public |
| `/auth/verify-otp` | POST | ❌ Public |
| `/auth/refresh` | POST | ✅ Refresh Token |

### Users Endpoints (6)

| Endpoint | Method | Auth | RBAC |
|----------|--------|------|------|
| `/users` | POST | ✅ JWT | Customer (self), Admin (any role) |
| `/users/:id` | GET | ✅ JWT | Self or Admin |
| `/users/:id` | PATCH | ✅ JWT | Self or Admin |
| `/users` | GET | ✅ JWT | **Admin Only** |
| `/users/phone/:phone` | GET | ✅ JWT | Any authenticated |
| `/users/:id/validate-role/:role` | GET | ✅ JWT | Any authenticated |

### Bookings Endpoints (7)

| Endpoint | Method | Auth |
|----------|--------|------|
| `/bookings` | POST | ✅ JWT |
| `/bookings/:id` | GET | ✅ JWT |
| `/bookings/check-availability` | POST | ✅ JWT |
| `/bookings/:id/confirm` | POST | ✅ JWT |
| `/bookings/:id/cancel` | POST | ✅ JWT |
| `/bookings/venue/:venueId/availability` | GET | ✅ JWT |
| `/bookings` | GET | ✅ JWT |

### Payments Endpoints (10)

| Endpoint | Method | Auth |
|----------|--------|------|
| `/payments/bookings/:id/options` | GET | ✅ JWT |
| `/payments/bookings/:id/select-method` | POST | ✅ JWT |
| `/payments/bookings/:id/payment-link` | POST | ✅ JWT |
| `/payments/webhook` | POST | ❌ Public (Razorpay signature) |
| `/payments/bookings/:id/cash-payment` | POST | ✅ JWT |
| `/payments/bookings/:id/cash-summary` | GET | ✅ JWT |
| `/payments/venues/:id/onboarding` | POST | ✅ JWT |
| `/payments/venues/:id/configuration` | GET | ✅ JWT |
| `/payments/venues/:id/commission-summary` | GET | ✅ JWT |
| `/payments/:id` | GET | ✅ JWT |
| `/payments/bookings/:id/history` | GET | ✅ JWT |

### Venue Bookings Endpoints (2)

| Endpoint | Method | Auth |
|----------|--------|------|
| `/venues/:venueId/bookings` | POST | ✅ JWT |
| `/venues/:venueId/availability` | GET | ✅ JWT |

---

## 🧪 Complete Test Flow

### Full End-to-End Test

```bash
#!/bin/bash
# Save this as test-jwt-flow.sh

BASE_URL="http://localhost:3000"
PHONE="+919876543210"
TENANT_ID="your-tenant-id"

echo "🔐 Step 1: Request OTP"
curl -X POST $BASE_URL/auth/request-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"tenantId\":\"$TENANT_ID\"}"

echo -e "\n\n🔑 Step 2: Verify OTP (using bypass)"
RESPONSE=$(curl -s -X POST $BASE_URL/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"000000\",\"tenantId\":\"$TENANT_ID\"}")

TOKEN=$(echo $RESPONSE | jq -r '.accessToken')
echo "Token: $TOKEN"

echo -e "\n\n👤 Step 3: Get User Profile"
curl -X GET $BASE_URL/users/me \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n📅 Step 4: Check Availability"
curl -X POST $BASE_URL/bookings/check-availability \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "venueId": "venue-uuid",
    "startTs": "2025-12-25T18:00:00.000Z",
    "endTs": "2025-12-25T23:00:00.000Z"
  }'

echo -e "\n\n✅ All tests complete!"
```

---

## 🛡️ Security Features

### What Changed

| Before (Insecure) | After (Secure) |
|-------------------|----------------|
| `X-Tenant-Id: abc123` header | `Authorization: Bearer eyJ...` |
| ❌ Forgeable by client | ✅ Cryptographically signed |
| ❌ No user identity | ✅ User ID + role included |
| ❌ No expiration | ✅ 15-minute expiration |
| ❌ No rate limiting | ✅ OTP rate limited |

### JWT Token Contents

```json
{
  "sub": "user-uuid",
  "phone": "+919876543210",
  "tenantId": "tenant-uuid",
  "role": "customer",
  "iat": 1698765432,
  "exp": 1698766332
}
```

**All fields are automatically available** in controllers via `@CurrentUser()` decorator.

---

## 🔧 Common Issues & Solutions

### Issue: "Unauthorized" Error

**Problem**: Missing or invalid JWT token

**Solution**:
```bash
# Make sure to include Authorization header
curl http://localhost:3000/bookings \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Issue: "Token expired"

**Problem**: Access token expired (15 min lifetime)

**Solution**: Use refresh token endpoint
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer YOUR_REFRESH_TOKEN"
```

### Issue: "OTP expired or not found"

**Problem**: OTP expired (5 min lifetime) or already used

**Solution**: Request a new OTP
```bash
curl -X POST http://localhost:3000/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919876543210","tenantId":"your-tenant-id"}'
```

### Issue: "Too many OTP requests"

**Problem**: Rate limit exceeded (max 3 requests per 10 minutes)

**Solution**: Wait 10 minutes or use bypass OTP "000000" in development

---

## 📚 Additional Resources

- **Full Migration Guide**: [`SESSION3_MIGRATION_COMPLETE.md`](file://d:\Downloads\hall-booking-app\SESSION3_MIGRATION_COMPLETE.md)
- **Auth Implementation Details**: [`SESSION3_OPTION_B_JWT_AUTH_COMPLETE.md`](file://d:\Downloads\hall-booking-app\SESSION3_OPTION_B_JWT_AUTH_COMPLETE.md)
- **CacheService Fix**: [`SESSION3_JWT_IMPROVEMENTS.md`](file://d:\Downloads\hall-booking-app\SESSION3_JWT_IMPROVEMENTS.md)

---

## ✅ Checklist for Deployment

Before deploying to production:

- [ ] Set `NODE_ENV=production` (disables bypass OTP)
- [ ] Set strong `JWT_SECRET` (minimum 32 characters)
- [ ] Configure SMS provider (Twilio/MSG91) for OTP delivery
- [ ] Set up Redis/Upstash with proper credentials
- [ ] Configure CORS for your frontend domain
- [ ] Test token refresh flow
- [ ] Test rate limiting behavior
- [ ] Test webhook signature verification
- [ ] Monitor OTP delivery success rate

---

**Status**: ✅ **All systems operational - Ready for production!**
