-- Migration: Add native PostgreSQL range columns for overlap prevention
-- Supabase compatible version using extensions already available

-- Enable required extensions (these are usually pre-enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Add tstzrange columns (with guards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='ts_range') THEN
    ALTER TABLE "bookings" ADD COLUMN "ts_range" TSTZRANGE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='availability_blackouts' AND column_name='ts_range') THEN
    ALTER TABLE "availability_blackouts" ADD COLUMN "ts_range" TSTZRANGE;
  END IF;
END$$;

-- Create trigger functions
CREATE OR REPLACE FUNCTION update_booking_ts_range()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ts_range = tstzrange(
    NEW."startTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
    NEW."endTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
    '[)'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_blackout_ts_range()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ts_range = tstzrange(
    NEW."startTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
    NEW."endTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 
    '[)'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (with guards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'booking_ts_range_trigger') THEN
    CREATE TRIGGER booking_ts_range_trigger
      BEFORE INSERT OR UPDATE ON "bookings"
      FOR EACH ROW
      EXECUTE FUNCTION update_booking_ts_range();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'blackout_ts_range_trigger') THEN
    CREATE TRIGGER blackout_ts_range_trigger
      BEFORE INSERT OR UPDATE ON "availability_blackouts"
      FOR EACH ROW
      EXECUTE FUNCTION update_blackout_ts_range();
  END IF;
END$$;

-- Create exclusion constraints (with guards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_booking_overlap') THEN
    ALTER TABLE "bookings" 
    ADD CONSTRAINT "no_booking_overlap" 
    EXCLUDE USING GIST (
      "tenantId" WITH =,
      "venueId" WITH =,
      "ts_range" WITH &&
    ) 
    WHERE ("status" IN ('temp_hold', 'pending', 'confirmed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_blackout_overlap') THEN
    ALTER TABLE "availability_blackouts"
    ADD CONSTRAINT "no_blackout_overlap"
    EXCLUDE USING GIST (
      "tenantId" WITH =,
      "venueId" WITH =, 
      "ts_range" WITH &&
    );
  END IF;
END$$;

-- Create GIST indexes (with guards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_bookings_ts_range') THEN
    CREATE INDEX "idx_bookings_ts_range" ON "bookings" 
    USING GIST ("tenantId", "venueId", "ts_range");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON c.oid=i.indexrelid 
                 WHERE c.relname='idx_blackouts_ts_range') THEN
    CREATE INDEX "idx_blackouts_ts_range" ON "availability_blackouts"
    USING GIST ("tenantId", "venueId", "ts_range");
  END IF;
END$$;

-- Add helpful comments
COMMENT ON COLUMN "bookings"."ts_range" IS 'PostgreSQL native range type for atomic overlap detection';
COMMENT ON CONSTRAINT "no_booking_overlap" ON "bookings" IS 'Prevents double-bookings at database level';
