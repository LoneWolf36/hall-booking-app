# Compilation Error Fix Implementation Guide

## Quick Fix Commands

```bash
# 1. Navigate to backend directory
cd backend

# 2. Make the fix script executable and run it
chmod +x scripts/fix-compilation-errors.sh
./scripts/fix-compilation-errors.sh

# 3. Apply remaining manual fixes (see below)
```

## Manual Fixes Required

After running the automated script, apply these manual fixes:

### 1. Swagger DTO Type Fixes

**File: `src/bookings/dto/booking-response.dto.ts`**
- **Line 82**: Change `type: 'object'` to `type: Object`
- **Line 193**: Change `type: 'object'` to `type: Object`

**File: `src/payments/dto/payment-options.dto.ts`**
- **Lines 169, 209, 411**: Change `type: 'object'` to `type: Object`
- **Line 469**: Add `additionalProperties: true` to the `@ApiProperty` decorator

### 2. Express Import Fix

**File: `src/payments/payments.controller.ts`**
```typescript
// Change line 18 from:
import { Request, Response } from 'express';

// To:
import type { Request, Response } from 'express';
```

### 3. Add PrismaService Dependency

**File: `src/payments/payments.controller.ts`**
```typescript
// Add this import
import { PrismaService } from '../prisma/prisma.service';

// Update constructor:
constructor(
  private readonly paymentsService: PaymentsService,
  private readonly prisma: PrismaService, // Add this line
) {}
```

### 4. Fix Razorpay Service Issues

**File: `src/payments/services/razorpay.service.ts`**

**Import fix (line 3):**
```typescript
// Change from:
import * as Razorpay from 'razorpay';

// To:
import Razorpay from 'razorpay';
```

**Type casting fixes (lines 120-123):**
```typescript
return {
  id: response.id,
  shortUrl: response.short_url,
  amount: Number(response.amount), // Add Number() casting
  currency: response.currency || 'INR', // Add fallback
  status: response.status,
  expireBy: response.expire_by ? new Date(response.expire_by * 1000) : new Date(), // Add null check
};
```

### 5. Fix Flexible Payment Service

**File: `src/payments/services/flexible-payment.service.ts`**

**Fix cached response (line 55):**
```typescript
// Change from:
return cached;

// To:
return cached as PaymentOptionsResponseDto;
```

**Fix steps array type (around line 728):**
```typescript
// Add this type definition at the function start:
const steps: Array<{
  action: string;
  description: string;
  deadline: Date;
}> = [];
```

### 6. Update TypeScript Configuration

**File: `tsconfig.json`**
```json
{
  "compilerOptions": {
    // ... existing options
    "allowSyntheticDefaultImports": true, // Add this line
    // ... rest of options
  }
}
```

### 7. Fix Missing User Import

**File: `src/users/users.service.ts`**
```typescript
// The User model should be available after Prisma regeneration
// If not, check that Prisma client is properly generated
import { User } from '@prisma/client';
```

## Verification Steps

```bash
# 1. Type check
npm run type-check

# 2. Build verification
npm run build

# 3. Start development server
npm run start:dev
```

## Root Cause Summary

| Error Category | Root Cause | Fix Applied |
|---|---|---|
| Prisma Types Missing | Client not regenerated | `npx prisma generate` |
| Cache Method Missing | Method name mismatch | `del()` → `delete()` |
| Swagger Object Types | String literal vs Type | `'object'` → `Object` |
| Express Type Imports | Runtime vs Type import | `import type` |
| Razorpay Types | Missing type casting | Added proper casting |
| Array Type Issues | Missing type definition | Added explicit types |
| Missing Dependencies | Service not injected | Added PrismaService |

## Troubleshooting

If errors persist after applying fixes:

1. **Clean and reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Regenerate Prisma client:**
   ```bash
   npx prisma generate --force
   ```

3. **Check for additional TypeScript strict mode issues:**
   ```bash
   npx tsc --noEmit --strict
   ```

## Success Indicators

✅ No TypeScript compilation errors
✅ `npm run build` succeeds
✅ `npm run start:dev` starts without errors
✅ All imports resolve correctly
✅ Swagger documentation generates properly