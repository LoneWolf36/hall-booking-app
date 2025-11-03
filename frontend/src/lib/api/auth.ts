// frontend/src/lib/api/auth.ts
import { apiPost } from '@/lib/api/client';

function normalizePhoneForIndia(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^\+91[6-9]\d{9}$/.test(input)) return input;
  return input;
}

export async function requestOtp(rawPhone: string, rawTenantId?: string) {
  const phone = normalizePhoneForIndia(rawPhone);
  const tenantId = (rawTenantId && rawTenantId.trim()) || process.env.NEXT_PUBLIC_TENANT_ID || 'tenant-1';
  return apiPost('/auth/request-otp', { phone, tenantId });
}
