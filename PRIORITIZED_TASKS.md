# 🎯 Prioritized Development Tasks

**Generated**: 2025-10-28  
**Status**: Todo list cleared, ready for frontend development

---

## 📊 Current Project Status

### ✅ Completed Backend Work (Previous Sessions)
- **JWT Authentication**: 100% migration complete (25 endpoints across 4 controllers)
- **SMS Integration**: MSG91 provider with OTP delivery (18/18 tests passing)
- **State Machine**: Booking lifecycle FSM with automated expiry (19/19 tests passing)
- **Core Features**: BookingsService, UsersService, PaymentsService with full JSDoc
- **Total**: 11 new files, 3,867 lines of code, 37 passing tests

### 🎯 Focus Areas Going Forward
1. **Frontend Development** - Build user-facing application (Next.js 16)
2. **Backend Quality** - Testing, documentation, and production hardening
3. **Enterprise Features** - Notifications, audit trails, security

---

## 🚀 HIGH PRIORITY TASKS

### Frontend Development (Critical Path)

#### **FE001: JWT Authentication UI** ⭐ HIGHEST PRIORITY
**Why Important**: Users cannot access the app without authentication  
**What to Build**:
- Login page with phone number input (international format support)
- OTP verification screen with 6-digit code input
- Auto-submit on 6th digit entry
- Resend OTP with countdown timer (30 seconds)
- Error handling for invalid OTP or expired codes

**Tech Stack**:
- React Hook Form + Zod validation
- ShadCN UI components (Input, Button, Form)
- Phone number validation (10 digits Indian format)

**API Integration**:
```typescript
POST /auth/request-otp
{
  "phone": "+919876543210",
  "tenantId": "tenant-uuid"
}

POST /auth/verify-otp
{
  "phone": "+919876543210",
  "otp": "123456",
  "tenantId": "tenant-uuid"
}
// Returns: { accessToken, refreshToken, user }
```

**Acceptance Criteria**:
- ✅ Phone validation prevents non-numeric input
- ✅ OTP screen shows after successful phone submission
- ✅ Tokens stored in localStorage/cookies
- ✅ Redirect to dashboard after successful login
- ✅ Error messages displayed for failed attempts

---

#### **FE002: Authentication Service Layer** ⭐ HIGHEST PRIORITY
**Why Important**: Core infrastructure for all authenticated API calls  
**What to Build**:
- Auth service with token management
- Axios interceptor for auto-adding JWT to requests
- Token refresh logic (before 15-min expiry)
- Auto-logout on 401 responses

**Implementation**:
```typescript
// services/auth.service.ts
class AuthService {
  async requestOtp(phone: string, tenantId: string)
  async verifyOtp(phone: string, otp: string, tenantId: string)
  async refreshToken(refreshToken: string)
  async logout()
  getAccessToken(): string | null
  isAuthenticated(): boolean
}

// lib/api.ts - Axios interceptor
axios.interceptors.request.use((config) => {
  const token = authService.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await authService.logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

**Acceptance Criteria**:
- ✅ All API calls automatically include JWT
- ✅ Token refresh happens before expiry
- ✅ 401 errors trigger logout and redirect
- ✅ TypeScript types for all responses

---

#### **FE003: Protected Routes & Auth Context** ⭐ HIGH PRIORITY
**Why Important**: Secure routes from unauthenticated access  
**What to Build**:
- AuthContext provider with user state
- ProtectedRoute wrapper component
- Role-based route guards (admin vs customer)
- Loading states during auth check

**Implementation**:
```typescript
// contexts/AuthContext.tsx
interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (phone: string, tenantId: string) => Promise<void>
  verifyOtp: (otp: string) => Promise<void>
  logout: () => Promise<void>
}

// components/ProtectedRoute.tsx
export function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode
  requiredRole?: 'admin' | 'customer'
}) {
  const { isAuthenticated, user, isLoading } = useAuth()
  
  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return <Navigate to="/login" />
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/unauthorized" />
  }
  
  return <>{children}</>
}
```

**Acceptance Criteria**:
- ✅ Unauthenticated users redirected to /login
- ✅ User data available via useAuth() hook
- ✅ Admin routes protected from customers
- ✅ Smooth loading states (no flash of content)

---

#### **FE004: Booking Creation Flow** ⭐ HIGH PRIORITY
**Why Important**: Core business feature - users need to create bookings  
**What to Build**:
- Multi-step form (3 steps: Venue → DateTime → Summary)
- Venue search/filter with payment profile display
- Date/time picker with availability checking
- Real-time total calculation (venue price + hours)
- Booking confirmation with payment options

**Step 1: Venue Selection**
- Search by name, location, capacity
- Filter by payment profile (cash_only, hybrid, full_online)
- Display venue cards with price, capacity, payment methods

**Step 2: Date & Time Selection**
- Calendar picker (react-day-picker)
- Time range selection with 1-hour minimum
- Real-time availability check (shows conflicts)
- Alternative time suggestions if unavailable

**Step 3: Booking Summary**
- Display all booking details
- Show total amount calculation
- Payment method selection (based on venue profile)
- Terms & conditions checkbox
- Submit button → Creates booking

**API Integration**:
```typescript
GET /availability/venue/:venueId?startTs=...&endTs=...
// Returns: { available: boolean, conflicts: [], alternatives: [] }

POST /bookings
{
  "venueId": "venue-uuid",
  "startTs": "2025-11-01T14:00:00Z",
  "endTs": "2025-11-01T18:00:00Z",
  "idempotencyKey": "unique-key"
}
// Returns: { booking, paymentOptions }
```

**Acceptance Criteria**:
- ✅ Users can complete entire booking flow
- ✅ Availability checked before submission
- ✅ Errors displayed clearly (double booking, validation)
- ✅ Idempotency key prevents duplicate submissions
- ✅ Mobile responsive design

---

#### **FE005: Booking List & History** ⭐ MEDIUM PRIORITY
**What to Build**:
- Booking list page with status filters
- Search by booking number or venue name
- Sort by date, status, amount
- Status badges with color coding
- Click to view booking details

**Filters**:
- Status: All | Pending | Confirmed | Cancelled | Completed
- Date range picker
- Payment status filter

**Booking Card Display**:
- Booking number + status badge
- Venue name + date/time
- Total amount + payment status
- Action buttons (Cancel, View Details)

**API Integration**:
```typescript
GET /bookings?status=confirmed&page=1&limit=20
// Returns: { bookings: [], total, page, limit }

GET /bookings/:id
// Returns: { booking with full details }

PATCH /bookings/:id/cancel
// Returns: { success, refundAmount }
```

---

#### **FE006: Payment Integration UI** ⭐ MEDIUM PRIORITY
**What to Build**:
- Payment method selection screen
- Razorpay checkout integration
- Cash payment confirmation flow
- Payment status tracking

**Payment Flows**:
1. **Cash Only**: Show "Pay at Venue" confirmation
2. **Deposit Required**: Razorpay for deposit amount
3. **Full Online**: Razorpay for total amount

**Razorpay Integration**:
```typescript
// Load Razorpay SDK
const options = {
  key: RAZORPAY_KEY_ID,
  amount: paymentAmount * 100, // paise
  currency: 'INR',
  name: 'Hall Booking',
  order_id: razorpayOrderId,
  handler: async (response) => {
    // Verify payment on backend
    await verifyPayment(response)
  }
}

const rzp = new Razorpay(options)
rzp.open()
```

---

## 🔧 BACKEND QUALITY TASKS

### **BE001: Complete State Machine Audit Trail** ⭐ HIGH PRIORITY
**From**: T-019 (code-review-tasks.json)  
**Why Important**: Compliance and debugging require full audit history

**What to Build**:
```prisma
model BookingAuditLog {
  id          String   @id @default(uuid())
  bookingId   String
  booking     Booking  @relation(fields: [bookingId], references: [id])
  
  fromStatus  BookingStatus
  toStatus    BookingStatus
  event       BookingEvent
  
  triggeredBy String?  // userId who triggered transition
  metadata    Json?    // Additional context
  
  createdAt   DateTime @default(now())
  
  @@index([bookingId, createdAt])
  @@map("booking_audit_logs")
}
```

**Update Files**:
- `backend/prisma/schema.prisma` - Add table
- `backend/src/bookings/services/state-machine.service.ts` - Use table instead of logger
- `backend/src/bookings/services/state-machine.service.spec.ts` - Update tests

**Acceptance Criteria**:
- ✅ Every state transition logged to database
- ✅ Includes who triggered (userId) and when
- ✅ Can retrieve full history for any booking
- ✅ Tests verify audit log creation

---

### **BE002: Notification System Implementation** ⭐ MEDIUM PRIORITY
**From**: T-026 (code-review-tasks.json)  
**Why Important**: Payment reminders reduce no-shows and unpaid bookings

**What to Build**:
- Notifications module with SMS + Email providers
- MSG91 SMS integration (already researched - ₹0.18/SMS)
- SendGrid email integration
- Payment reminder cron job (runs daily)
- Notification log table

**Architecture**:
```typescript
// notifications/interfaces/notification-provider.interface.ts
interface INotificationProvider {
  sendSms(phone: string, message: string, templateId?: string): Promise<boolean>
  sendEmail(to: string, subject: string, body: string, templateId?: string): Promise<boolean>
}

// notifications/providers/msg91.provider.ts
class Msg91Provider implements INotificationProvider {
  // Uses existing SmsService logic
}

// notifications/providers/sendgrid.provider.ts
class SendgridProvider implements INotificationProvider {
  // Email implementation
}

// notifications/jobs/payment-reminder.job.ts
@Cron(CronExpression.EVERY_DAY_AT_10AM)
async sendPaymentReminders() {
  // Find bookings with payment due in 3 days, 1 day, today
  // Send SMS + Email reminders
  // Log to notification_logs table
}
```

**Environment Variables**:
```bash
MSG91_AUTH_KEY=your-key        # Already configured
MSG91_SENDER_ID=HALLBK          # DLT-approved sender ID

SENDGRID_API_KEY=your-key
SENDGRID_FROM_EMAIL=noreply@hallbooking.com
SENDGRID_FROM_NAME="Hall Booking System"
```

**Reminder Schedule**:
- 3 days before payment due: "Payment due in 3 days for booking #12345"
- 1 day before: "Payment due tomorrow! Booking #12345"
- Day of: "Payment due today for booking #12345. Pay now to avoid cancellation"

**Acceptance Criteria**:
- ✅ SMS sent via MSG91 in production
- ✅ Email sent via SendGrid
- ✅ Reminders only sent once per booking per milestone
- ✅ Notification logs track delivery status
- ✅ Cron job runs reliably every day

---

### **BE003: Unit Tests for Common Services** ⭐ MEDIUM PRIORITY
**From**: T-012, T-013, T-014 (code-review-tasks.json)

**ValidationService Tests** (T-012):
```typescript
describe('ValidationService', () => {
  it('should validate timestamp is in future')
  it('should reject timestamps beyond MAX_BOOKING_MONTHS_AHEAD')
  it('should validate duration is within min/max hours')
  it('should validate lead time requirements')
  it('should validate venue exists and is active')
  it('should validate string length constraints')
})
```

**CacheService Tests** (T-013):
```typescript
describe('CacheService', () => {
  it('should get booking from cache')
  it('should return null on cache miss')
  it('should invalidate booking cache')
  it('should invalidate availability cache')
  it('should use correct TTL values')
})
```

**ErrorHandlerService Tests** (T-014):
```typescript
describe('ErrorHandlerService', () => {
  it('should transform Prisma P2002 to user-friendly message')
  it('should handle PostgreSQL 23P01 exclusion constraint')
  it('should extract table/column from constraint errors')
  it('should enhance context for better debugging')
})
```

**Estimated Effort**: 2-3 hours  
**Impact**: Catches bugs, improves code quality, enables refactoring

---

### **BE004: Run Full Test Suite** ⭐ HIGH PRIORITY
**From**: T-030 (code-review-tasks.json)

**Command**:
```bash
cd backend
npm run test:validate-all > test-results.txt 2>&1
```

**Fix Failing Tests**:
- Review all test failures
- Update mocks to match current service architecture
- Fix type errors and import issues
- Ensure 100% test pass rate

**Expected Outcome**:
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ E2E tests passing
- ✅ No TypeScript errors
- ✅ Test coverage report generated

---

### **BE005: Fix All Linting Errors** ⭐ HIGH PRIORITY
**From**: T-031 (code-review-tasks.json)

**Command**:
```bash
cd backend
npm run lint -- --fix > lint-results.txt 2>&1
```

**Common Issues to Fix**:
- Unused imports
- Unused variables
- Missing return types
- Inconsistent spacing
- Missing semicolons
- ESLint rule violations

**Expected Outcome**:
- ✅ Zero linting errors
- ✅ Zero linting warnings
- ✅ Consistent code style

---

### **BE006: Security & Rate Limiting** ⭐ MEDIUM PRIORITY
**From**: T-027, T-028 (code-review-tasks.json)

**Security Logging** (T-027):
```typescript
// Add to PaymentsService
async createPaymentLink(bookingId: string, userId: string) {
  this.logger.log({
    event: 'payment_link_created',
    bookingId,
    userId,
    timestamp: new Date().toISOString(),
    // Do NOT log: payment amounts, personal data
  })
}

// Add to UsersService
async updateUserRole(userId: string, newRole: string, adminId: string) {
  this.logger.log({
    event: 'user_role_changed',
    userId,
    newRole,
    changedBy: adminId,
    timestamp: new Date().toISOString(),
  })
}
```

**Rate Limiting** (T-028):
```bash
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler'

ThrottlerModule.forRoot({
  ttl: 60,      // 60 seconds
  limit: 10,    // 10 requests per TTL
})

// bookings.controller.ts
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post()
async createBooking() {
  // Stricter limit for booking creation
}
```

**Acceptance Criteria**:
- ✅ All sensitive operations logged
- ✅ Logs include user context but not PII
- ✅ Rate limiting prevents abuse
- ✅ Webhook endpoints excluded from rate limiting

---

## 📋 Code Review Tasks Summary

### From `code-review-tasks.json` (35 total tasks)

**Completed (8 tasks)**:
- ✅ T-001: JSDoc for BookingsService
- ✅ T-002: JSDoc for UsersService  
- ✅ T-003: JSDoc for PaymentsService
- ✅ T-004: Implement placeholder methods
- ✅ T-005: JWT authentication (100% migration)
- ✅ T-007: JSDoc for AvailabilityService
- ✅ T-008: JSDoc for BookingNumberService
- ✅ T-017: Enhance BookingsService tests (31/31 passing)

**High Priority Open (7 tasks)**:
- ⭐ T-012: Unit tests for ValidationService
- ⭐ T-013: Unit tests for CacheService
- ⭐ T-014: Unit tests for ErrorHandlerService
- ⭐ T-019: State machine audit trail (BE001)
- ⭐ T-027: Security logging (BE006)
- ⭐ T-030: Run full test suite (BE004)
- ⭐ T-031: Fix linting errors (BE005)

**Medium Priority Open (4 tasks)**:
- T-026: Notification system (BE002)
- T-028: Rate limiting (BE006)
- T-029: Integration tests for booking flow
- T-011: Circular dependency check

**Low Priority / Documentation (16 tasks)**:
- T-006, T-009, T-010: JSDoc for remaining services
- T-020, T-021, T-022, T-023: Documentation tasks
- T-024: Database index review
- T-032, T-033, T-034, T-035: Documentation & architecture

---

## 🎯 Recommended Sprint Plan

### **Sprint 1: Frontend Foundation (Week 1)**
**Goal**: Users can login and view bookings

1. **Day 1-2**: FE001 + FE002 (Authentication UI + Service)
2. **Day 3**: FE003 (Protected Routes)
3. **Day 4-5**: FE005 (Booking List - read-only first)

**Deliverable**: Users can login and see their bookings

---

### **Sprint 2: Booking Creation (Week 2)**
**Goal**: Users can create new bookings

1. **Day 1-3**: FE004 (Booking Creation Flow)
2. **Day 4**: FE006 (Payment UI - basic version)
3. **Day 5**: Testing & Bug Fixes

**Deliverable**: Complete booking creation flow

---

### **Sprint 3: Backend Quality (Week 3)**
**Goal**: Production-ready backend

1. **Day 1**: BE004 + BE005 (Tests + Linting)
2. **Day 2**: BE003 (Common Services Tests)
3. **Day 3**: BE001 (Audit Trail)
4. **Day 4**: BE006 (Security Logging + Rate Limiting)
5. **Day 5**: BE002 (Notification System)

**Deliverable**: All tests passing, code quality high, audit trail complete

---

## 📊 Success Metrics

### Frontend
- ✅ Authentication flow works end-to-end
- ✅ Users can create bookings successfully
- ✅ Mobile responsive on all screens
- ✅ < 3 second page load times
- ✅ Zero TypeScript errors

### Backend
- ✅ 100% test pass rate (unit + integration + e2e)
- ✅ Zero linting errors/warnings
- ✅ All state transitions logged to audit table
- ✅ SMS delivery success rate > 95%
- ✅ Rate limiting prevents abuse

### Business
- ✅ Zero double bookings (exclusion constraint working)
- ✅ Payment reminders reduce no-shows
- ✅ Audit trail enables compliance reporting
- ✅ System handles 100+ concurrent bookings

---

## 🚀 Getting Started

### Start Frontend Development
```bash
cd frontend
npm run dev
# Frontend: http://localhost:3001
```

### Start Backend
```bash
cd backend
npm run start:dev
# Backend: http://localhost:3000
```

### Run Tests
```bash
cd backend
npm run test:validate-all
npm run lint -- --fix
```

---

**Next Action**: Start with **FE001 (Authentication UI)** - This unblocks all other frontend work!
