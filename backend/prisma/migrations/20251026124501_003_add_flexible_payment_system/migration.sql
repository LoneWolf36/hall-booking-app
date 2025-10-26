-- Migration: Add flexible payment system with proper UUID foreign keys
-- Supabase compatible version using gen_random_uuid() with COMPLETE idempotent guards

-- Enhanced venue payment configuration (with guards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='paymentProfile') THEN
    ALTER TABLE "venues" ADD COLUMN "paymentProfile" VARCHAR(20) DEFAULT 'cash_only' 
      CHECK ("paymentProfile" IN ('cash_only','cash_deposit','hybrid','full_online','marketplace'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='allowCashPayments') THEN
    ALTER TABLE "venues" ADD COLUMN "allowCashPayments" BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='cashDiscountPercentage') THEN
    ALTER TABLE "venues" ADD COLUMN "cashDiscountPercentage" DECIMAL(5,2) DEFAULT 0 
      CHECK ("cashDiscountPercentage" >= 0 AND "cashDiscountPercentage" <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='requiresOnlineDeposit') THEN
    ALTER TABLE "venues" ADD COLUMN "requiresOnlineDeposit" BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='depositType') THEN
    ALTER TABLE "venues" ADD COLUMN "depositType" VARCHAR(10) DEFAULT 'percentage' 
      CHECK ("depositType" IN ('percentage','fixed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='depositAmount') THEN
    ALTER TABLE "venues" ADD COLUMN "depositAmount" INTEGER DEFAULT 25 CHECK ("depositAmount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='hasRazorpayAccount') THEN
    ALTER TABLE "venues" ADD COLUMN "hasRazorpayAccount" BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='razorpayKeyId') THEN
    ALTER TABLE "venues" ADD COLUMN "razorpayKeyId" VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='razorpayKeySecretEncrypted') THEN
    ALTER TABLE "venues" ADD COLUMN "razorpayKeySecretEncrypted" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='platformHandlesPayments') THEN
    ALTER TABLE "venues" ADD COLUMN "platformHandlesPayments" BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='confirmationTrigger') THEN
    ALTER TABLE "venues" ADD COLUMN "confirmationTrigger" VARCHAR(20) DEFAULT 'manual_approval' 
      CHECK ("confirmationTrigger" IN ('deposit_only','full_payment','manual_approval'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='platformCommissionPercentage') THEN
    ALTER TABLE "venues" ADD COLUMN "platformCommissionPercentage" DECIMAL(5,2) DEFAULT 10.00 
      CHECK ("platformCommissionPercentage" >= 0 AND "platformCommissionPercentage" <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='paymentDueDaysBeforeEvent') THEN
    ALTER TABLE "venues" ADD COLUMN "paymentDueDaysBeforeEvent" INTEGER DEFAULT 7 
      CHECK ("paymentDueDaysBeforeEvent" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='venues' AND column_name='autoExpireUnpaidBookings') THEN
    ALTER TABLE "venues" ADD COLUMN "autoExpireUnpaidBookings" BOOLEAN DEFAULT true;
  END IF;
END$$;

-- Enhanced booking payment tracking with UUID foreign keys (with guards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='paymentMethod') THEN
    ALTER TABLE "bookings" ADD COLUMN "paymentMethod" VARCHAR(20) 
      CHECK ("paymentMethod" IN ('cash_full','deposit_online','hybrid_flexible','full_online','marketplace'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='onlineAmountDue') THEN
    ALTER TABLE "bookings" ADD COLUMN "onlineAmountDue" INTEGER DEFAULT 0 CHECK ("onlineAmountDue" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='cashAmountDue') THEN
    ALTER TABLE "bookings" ADD COLUMN "cashAmountDue" INTEGER DEFAULT 0 CHECK ("cashAmountDue" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='requiresManualConfirmation') THEN
    ALTER TABLE "bookings" ADD COLUMN "requiresManualConfirmation" BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='confirmedBy') THEN
    ALTER TABLE "bookings" ADD COLUMN "confirmedBy" UUID REFERENCES "users"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='cashDiscountApplied') THEN
    ALTER TABLE "bookings" ADD COLUMN "cashDiscountApplied" INTEGER DEFAULT 0 CHECK ("cashDiscountApplied" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='paymentDueDate') THEN
    ALTER TABLE "bookings" ADD COLUMN "paymentDueDate" TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='cashPaymentAcknowledged') THEN
    ALTER TABLE "bookings" ADD COLUMN "cashPaymentAcknowledged" BOOLEAN DEFAULT false;
  END IF;
END$$;

-- Cash payment tracking with UUID foreign keys (Supabase compatible)
CREATE TABLE IF NOT EXISTS "cash_payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "bookingId" UUID NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "recordedBy" UUID REFERENCES "users"("id"),
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "paymentMethod" VARCHAR(20) DEFAULT 'cash' 
    CHECK ("paymentMethod" IN ('cash','cheque','bank_transfer','upi_cash')),
  "notes" TEXT,
  "receiptNumber" VARCHAR(100),
  "verificationStatus" VARCHAR(20) DEFAULT 'pending' 
    CHECK ("verificationStatus" IN ('pending','verified','disputed')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Platform commission tracking with UUID foreign keys (Supabase compatible)
CREATE TABLE IF NOT EXISTS "commission_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "bookingId" UUID NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "venueId" UUID NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "bookingAmountCents" INTEGER NOT NULL CHECK ("bookingAmountCents" > 0),
  "commissionPercentage" DECIMAL(5,2) NOT NULL CHECK ("commissionPercentage" >= 0),
  "commissionAmountCents" INTEGER NOT NULL CHECK ("commissionAmountCents" >= 0),
  "commissionStatus" VARCHAR(20) DEFAULT 'pending' 
    CHECK ("commissionStatus" IN ('pending','collected','waived','disputed')),
  "collectionMethod" VARCHAR(30) 
    CHECK ("collectionMethod" IN ('auto_deduct','manual_payment','monthly_invoice','cash_settlement')),
  "collectedAt" TIMESTAMPTZ,
  "dueDate" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Customer payment preferences with UUID foreign keys (Supabase compatible)
CREATE TABLE IF NOT EXISTS "customer_payment_preferences" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "preferredMethod" VARCHAR(20) DEFAULT 'cash' 
    CHECK ("preferredMethod" IN ('cash','online','hybrid')),
  "cityTier" VARCHAR(10) CHECK ("cityTier" IN ('tier1','tier2','tier3')),
  "lastPaymentMethod" VARCHAR(20),
  "totalBookings" INTEGER DEFAULT 0,
  "totalOnlinePayments" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist (SAFER VERSION)
DO $$
BEGIN
  -- Check if any constraint with this purpose already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'customer_payment_preferences'
    AND c.contype = 'u'  -- unique constraint
    AND array_length(c.conkey, 1) = 2  -- constraint on 2 columns
  ) THEN
    ALTER TABLE "customer_payment_preferences" 
    ADD CONSTRAINT "customer_payment_preferences_tenantId_userId_key" 
    UNIQUE("tenantId", "userId");
  END IF;
EXCEPTION 
  WHEN duplicate_table THEN
    -- Constraint already exists, do nothing
    NULL;
  WHEN others THEN
    -- Log the error but continue
    RAISE NOTICE 'Unique constraint may already exist: %', SQLERRM;
END$$;

-- Venue onboarding responses with UUID foreign keys (Supabase compatible)
CREATE TABLE IF NOT EXISTS "venue_onboarding_responses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "venueId" UUID NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "paymentPreference" VARCHAR(20) 
    CHECK ("paymentPreference" IN ('cash_only','mostly_cash','mixed','online_preferred','platform_managed')),
  "techComfortLevel" VARCHAR(20) 
    CHECK ("techComfortLevel" IN ('no_tech','basic_tech','advanced_tech')),
  "currentPaymentMethods" JSONB,
  "monthlyBookingVolume" INTEGER,
  "averageBookingValueCents" INTEGER,
  "responses" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes (with guards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_venues_payment_profile') THEN
    CREATE INDEX "idx_venues_payment_profile" ON "venues"("paymentProfile");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_bookings_payment_method') THEN
    CREATE INDEX "idx_bookings_payment_method" ON "bookings"("paymentMethod");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_bookings_confirmation') THEN
    CREATE INDEX "idx_bookings_confirmation" ON "bookings"("requiresManualConfirmation","status");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_cash_payments_booking') THEN
    CREATE INDEX "idx_cash_payments_booking" ON "cash_payments"("bookingId");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_cash_payments_recorded_by') THEN
    CREATE INDEX "idx_cash_payments_recorded_by" ON "cash_payments"("recordedBy","recordedAt");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_commission_records_status') THEN
    CREATE INDEX "idx_commission_records_status" ON "commission_records"("commissionStatus","dueDate");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_commission_records_venue') THEN
    CREATE INDEX "idx_commission_records_venue" ON "commission_records"("venueId","createdAt");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_customer_preferences_user') THEN
    CREATE INDEX "idx_customer_preferences_user" ON "customer_payment_preferences"("userId");
  END IF;
END$$;

-- Documentation comments
COMMENT ON COLUMN "venues"."paymentProfile" IS 'Venue payment strategy: cash_only, cash_deposit, hybrid, full_online, marketplace';
COMMENT ON COLUMN "venues"."depositAmount" IS 'Deposit amount: percentage (25) or fixed amount in cents (500000 for ₹5000)';
COMMENT ON COLUMN "bookings"."paymentMethod" IS 'Selected payment method for this specific booking';
COMMENT ON COLUMN "cash_payments"."verificationStatus" IS 'Status of cash payment verification by venue';
COMMENT ON COLUMN "commission_records"."collectionMethod" IS 'How platform commission will be collected from venue';
COMMENT ON TABLE "customer_payment_preferences" IS 'Tracks customer payment behavior for smart option suggestions';
