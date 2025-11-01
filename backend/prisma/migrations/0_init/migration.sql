-- prisma/migrations/0_init/migration.sql

-- Optional but safe on Supabase
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core tables
CREATE TABLE "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "venues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "capacity" INTEGER,
  "basePriceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "settings" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "paymentProfile" TEXT NOT NULL DEFAULT 'cash_only',
  "allowCashPayments" BOOLEAN NOT NULL DEFAULT true,
  "cashDiscountPercentage" DECIMAL(5,2),
  "requiresOnlineDeposit" BOOLEAN NOT NULL DEFAULT false,
  "depositType" TEXT NOT NULL DEFAULT 'percentage',
  "depositAmount" INTEGER NOT NULL DEFAULT 25,
  "hasRazorpayAccount" BOOLEAN NOT NULL DEFAULT false,
  "razorpayKeyId" TEXT,
  "razorpayKeySecretEncrypted" TEXT,
  "platformHandlesPayments" BOOLEAN NOT NULL DEFAULT false,
  "confirmationTrigger" TEXT NOT NULL DEFAULT 'manual_approval',
  "platformCommissionPercentage" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  "paymentDueDaysBeforeEvent" INTEGER NOT NULL DEFAULT 7,
  "autoExpireUnpaidBookings" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "role" TEXT NOT NULL DEFAULT 'customer',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bookings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "venueId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "bookingNumber" TEXT NOT NULL,
  "startTs" TIMESTAMP(3) NOT NULL,
  "endTs" TIMESTAMP(3) NOT NULL,
  "tsRange" tstzrange,
  "status" TEXT NOT NULL DEFAULT 'temp_hold',
  "holdExpiresAt" TIMESTAMP(3),
  "totalAmountCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "paymentMethod" TEXT,
  "onlineAmountDue" INTEGER NOT NULL DEFAULT 0,
  "cashAmountDue" INTEGER NOT NULL DEFAULT 0,
  "cashDiscountApplied" INTEGER NOT NULL DEFAULT 0,
  "paymentDueDate" TIMESTAMP(3),
  "cashPaymentAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "requiresManualConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "confirmedBy" UUID,
  "confirmedAt" TIMESTAMP(3),
  "rejectedBy" UUID,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "adminNotes" TEXT,
  "paidAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "eventType" TEXT,
  "guestCount" INTEGER,
  "specialRequests" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "availability_blackouts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "venueId" UUID NOT NULL,
  "startTs" TIMESTAMP(3) NOT NULL,
  "endTs" TIMESTAMP(3) NOT NULL,
  "tsRange" tstzrange,
  "reason" TEXT,
  "isMaintenance" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "availability_blackouts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "bookingId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "gatewayResponse" JSONB,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "bookingId" UUID NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "recordedBy" UUID,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
  "notes" TEXT,
  "receiptNumber" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commission_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "bookingId" UUID NOT NULL,
  "venueId" UUID NOT NULL,
  "bookingAmountCents" INTEGER NOT NULL,
  "commissionPercentage" DECIMAL(5,2) NOT NULL,
  "commissionAmountCents" INTEGER NOT NULL,
  "commissionStatus" TEXT NOT NULL DEFAULT 'pending',
  "collectionMethod" TEXT,
  "collectedAt" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commission_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_payment_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "preferredMethod" TEXT NOT NULL DEFAULT 'cash',
  "cityTier" TEXT,
  "lastPaymentMethod" TEXT,
  "totalBookings" INTEGER NOT NULL DEFAULT 0,
  "totalOnlinePayments" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_payment_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "venue_onboarding_responses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "venueId" UUID NOT NULL,
  "paymentPreference" TEXT,
  "techComfortLevel" TEXT,
  "currentPaymentMethods" JSONB,
  "monthlyBookingVolume" INTEGER,
  "averageBookingValueCents" INTEGER,
  "responses" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "venue_onboarding_responses_pkey" PRIMARY KEY ("id")
);

-- Phase5-T-038 additions present in schema
CREATE TABLE "booking_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bookingId" UUID NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "event" TEXT NOT NULL DEFAULT 'state_change',
  "triggeredBy" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bookingId" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'cash',
  "status" TEXT NOT NULL DEFAULT 'completed',
  "recordedBy" UUID,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_payments_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "venues_paymentProfile_idx" ON "venues"("paymentProfile");
CREATE UNIQUE INDEX "venues_tenantId_name_key" ON "venues"("tenantId", "name");
CREATE UNIQUE INDEX "users_tenantId_phone_key" ON "users"("tenantId", "phone");

CREATE INDEX "bookings_tenantId_venueId_startTs_endTs_idx" ON "bookings"("tenantId","venueId","startTs","endTs");
CREATE INDEX "bookings_status_holdExpiresAt_idx" ON "bookings"("status","holdExpiresAt");
CREATE INDEX "bookings_paymentMethod_idx" ON "bookings"("paymentMethod");
CREATE INDEX "bookings_requiresManualConfirmation_status_idx" ON "bookings"("requiresManualConfirmation","status");
CREATE UNIQUE INDEX "bookings_tenantId_bookingNumber_key" ON "bookings"("tenantId","bookingNumber");
CREATE UNIQUE INDEX "bookings_tenantId_idempotencyKey_key" ON "bookings"("tenantId","idempotencyKey");

CREATE INDEX "availability_blackouts_tenantId_venueId_startTs_endTs_idx" ON "availability_blackouts"("tenantId","venueId","startTs","endTs");
CREATE INDEX "payments_tenantId_bookingId_status_idx" ON "payments"("tenantId","bookingId","status");
CREATE INDEX "cash_payments_bookingId_idx" ON "cash_payments"("bookingId");
CREATE INDEX "cash_payments_recordedBy_recordedAt_idx" ON "cash_payments"("recordedBy","recordedAt");
CREATE INDEX "commission_records_commissionStatus_dueDate_idx" ON "commission_records"("commissionStatus","dueDate");
CREATE INDEX "commission_records_venueId_createdAt_idx" ON "commission_records"("venueId","createdAt");
CREATE INDEX "customer_payment_preferences_userId_idx" ON "customer_payment_preferences"("userId");

CREATE INDEX "booking_audit_logs_bookingId_createdAt_idx" ON "booking_audit_logs"("bookingId","createdAt");
CREATE INDEX "booking_audit_logs_triggeredBy_idx" ON "booking_audit_logs"("triggeredBy");
CREATE INDEX "booking_payments_bookingId_idx" ON "booking_payments"("bookingId");

-- FKs
ALTER TABLE "venues" ADD CONSTRAINT "venues_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_confirmedBy_fkey"
  FOREIGN KEY ("confirmedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "availability_blackouts" ADD CONSTRAINT "availability_blackouts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "availability_blackouts" ADD CONSTRAINT "availability_blackouts_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cash_payments" ADD CONSTRAINT "cash_payments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_payments" ADD CONSTRAINT "cash_payments_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_payments" ADD CONSTRAINT "cash_payments_recordedBy_fkey"
  FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_payment_preferences" ADD CONSTRAINT "customer_payment_preferences_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_payment_preferences" ADD CONSTRAINT "customer_payment_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- booking_audit_logs has no FK in schema; add one only if you decide to enforce it later.
