-- Migration: Add flexible payment system support
-- This enables venues to choose their preferred payment methods
-- From cash-only to fully online operations

-- Enhanced venue payment configuration
ALTER TABLE venues ADD COLUMN payment_profile VARCHAR(20) DEFAULT 'cash_only' CHECK (payment_profile IN ('cash_only', 'cash_deposit', 'hybrid', 'full_online', 'marketplace'));
ALTER TABLE venues ADD COLUMN allow_cash_payments BOOLEAN DEFAULT true;
ALTER TABLE venues ADD COLUMN cash_discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (cash_discount_percentage >= 0 AND cash_discount_percentage <= 50);
ALTER TABLE venues ADD COLUMN requires_online_deposit BOOLEAN DEFAULT false;
ALTER TABLE venues ADD COLUMN deposit_type VARCHAR(10) DEFAULT 'percentage' CHECK (deposit_type IN ('percentage', 'fixed'));
ALTER TABLE venues ADD COLUMN deposit_amount INTEGER DEFAULT 25 CHECK (deposit_amount > 0); -- 25% or ₹5000 etc
ALTER TABLE venues ADD COLUMN has_razorpay_account BOOLEAN DEFAULT false;
ALTER TABLE venues ADD COLUMN razorpay_key_id VARCHAR(100);
ALTER TABLE venues ADD COLUMN razorpay_key_secret_encrypted TEXT;
ALTER TABLE venues ADD COLUMN platform_handles_payments BOOLEAN DEFAULT false;
ALTER TABLE venues ADD COLUMN confirmation_trigger VARCHAR(20) DEFAULT 'manual_approval' CHECK (confirmation_trigger IN ('deposit_only', 'full_payment', 'manual_approval'));
ALTER TABLE venues ADD COLUMN platform_commission_percentage DECIMAL(5,2) DEFAULT 10.00 CHECK (platform_commission_percentage >= 0 AND platform_commission_percentage <= 50);
ALTER TABLE venues ADD COLUMN payment_due_days_before_event INTEGER DEFAULT 7 CHECK (payment_due_days_before_event >= 0);
ALTER TABLE venues ADD COLUMN auto_expire_unpaid_bookings BOOLEAN DEFAULT true;

-- Enhanced booking payment tracking
ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(20) CHECK (payment_method IN ('cash_full', 'deposit_online', 'hybrid_flexible', 'full_online', 'marketplace'));
ALTER TABLE bookings ADD COLUMN online_amount_due INTEGER DEFAULT 0 CHECK (online_amount_due >= 0);
ALTER TABLE bookings ADD COLUMN cash_amount_due INTEGER DEFAULT 0 CHECK (cash_amount_due >= 0);
ALTER TABLE bookings ADD COLUMN requires_manual_confirmation BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN confirmed_by UUID REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN cash_discount_applied INTEGER DEFAULT 0 CHECK (cash_discount_applied >= 0);
ALTER TABLE bookings ADD COLUMN payment_due_date TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN cash_payment_acknowledged BOOLEAN DEFAULT false;

-- Cash payment tracking
CREATE TABLE cash_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  recorded_by UUID REFERENCES users(id), -- Venue staff who recorded payment
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'upi_cash')),
  notes TEXT,
  receipt_number VARCHAR(100),
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'disputed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform commission tracking
CREATE TABLE commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  booking_amount_cents INTEGER NOT NULL CHECK (booking_amount_cents > 0),
  commission_percentage DECIMAL(5,2) NOT NULL CHECK (commission_percentage >= 0),
  commission_amount_cents INTEGER NOT NULL CHECK (commission_amount_cents >= 0),
  commission_status VARCHAR(20) DEFAULT 'pending' CHECK (commission_status IN ('pending', 'collected', 'waived', 'disputed')),
  collection_method VARCHAR(30) CHECK (collection_method IN ('auto_deduct', 'manual_payment', 'monthly_invoice', 'cash_settlement')),
  collected_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment method preferences (customer level)
CREATE TABLE customer_payment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferred_method VARCHAR(20) DEFAULT 'cash' CHECK (preferred_method IN ('cash', 'online', 'hybrid')),
  city_tier VARCHAR(10) CHECK (city_tier IN ('tier1', 'tier2', 'tier3')),
  last_payment_method VARCHAR(20),
  total_bookings INTEGER DEFAULT 0,
  total_online_payments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Venue onboarding responses
CREATE TABLE venue_onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  payment_preference VARCHAR(20) CHECK (payment_preference IN ('cash_only', 'mostly_cash', 'mixed', 'online_preferred', 'platform_managed')),
  tech_comfort_level VARCHAR(20) CHECK (tech_comfort_level IN ('no_tech', 'basic_tech', 'advanced_tech')),
  current_payment_methods JSONB,
  monthly_booking_volume INTEGER,
  average_booking_value_cents INTEGER,
  responses JSONB, -- Store all questionnaire responses
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_venues_payment_profile ON venues(payment_profile);
CREATE INDEX idx_bookings_payment_method ON bookings(payment_method);
CREATE INDEX idx_bookings_confirmation ON bookings(requires_manual_confirmation, status);
CREATE INDEX idx_cash_payments_booking ON cash_payments(booking_id);
CREATE INDEX idx_cash_payments_recorded_by ON cash_payments(recorded_by, recorded_at);
CREATE INDEX idx_commission_records_status ON commission_records(commission_status, due_date);
CREATE INDEX idx_commission_records_venue ON commission_records(venue_id, created_at);
CREATE INDEX idx_customer_preferences_user ON customer_payment_preferences(user_id);

-- Comments for documentation
COMMENT ON COLUMN venues.payment_profile IS 'Venue payment strategy: cash_only, cash_deposit, hybrid, full_online, marketplace';
COMMENT ON COLUMN venues.deposit_amount IS 'Deposit amount: percentage (25) or fixed amount in cents (500000 for ₹5000)';
COMMENT ON COLUMN bookings.payment_method IS 'Selected payment method for this specific booking';
COMMENT ON COLUMN cash_payments.verification_status IS 'Status of cash payment verification by venue';
COMMENT ON COLUMN commission_records.collection_method IS 'How platform commission will be collected from venue';
COMMENT ON TABLE customer_payment_preferences IS 'Tracks customer payment behavior for smart option suggestions';