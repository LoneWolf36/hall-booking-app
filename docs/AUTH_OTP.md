# Auth & OTP Integration

This project now standardizes OTP requests so the frontend behaves exactly like the validated curl examples.

## Frontend

- Use `AuthService.requestOtp(phone, '+91', process.env.NEXT_PUBLIC_TENANT_ID)` from `frontend/src/services/auth.service.ts`.
- The service:
  - Normalizes Indian phone numbers: converts 10-digit numbers starting 6–9 into `+91XXXXXXXXXX`.
  - Always includes `tenantId`, reading `NEXT_PUBLIC_TENANT_ID` or defaulting to `tenant-1` for dev.

### Required env

Create `frontend/.env.local` with:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_TENANT_ID=tenant-1
```

## Backend
- DTO requires `{ phone, tenantId }`.
- Dev OTP is `000000`.

## Cleanup notes
- Prefer calling `AuthService.requestOtp` from pages/components.
- Avoid duplicating OTP helper functions; use the service to keep behavior consistent across the app.
