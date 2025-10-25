-- ===============================================================
-- Prisma Migration: Add Native Postgres Range Columns & Constraints
-- ===============================================================
-- Purpose:
--  - Introduce native TSTZRANGE columns for overlap prevention.
--  - Enforce non-overlapping bookings and blackouts at DB level.
--  - Keep ts_range synced with Prisma-managed startTs/endTs.
--  - Fully compatible with Prisma schema and re-runnable safely.
-- ===============================================================

-- 1) Enable required extensions
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2) Add native tstzrange columns alongside Prisma timestamps
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS ts_range TSTZRANGE;

ALTER TABLE "availability_blackouts"
  ADD COLUMN IF NOT EXISTS ts_range TSTZRANGE;

-- 3) Backfill existing rows (if any)
UPDATE "bookings"
SET ts_range = tstzrange("startTs", "endTs", '[)')
WHERE ts_range IS NULL;

UPDATE "availability_blackouts"
SET ts_range = tstzrange("startTs", "endTs", '[)')
WHERE ts_range IS NULL;

-- 4) Add validity checks for time ranges
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_valid_booking_range'
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT chk_valid_booking_range CHECK ("startTs" < "endTs");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_valid_blackout_range'
  ) THEN
    ALTER TABLE "availability_blackouts"
      ADD CONSTRAINT chk_valid_blackout_range CHECK ("startTs" < "endTs");
  END IF;
END $$;

-- 5) Add exclusion constraints to prevent overlaps per venue & tenant
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_booking_overlap'
  ) THEN
    ALTER TABLE "bookings" ADD CONSTRAINT no_booking_overlap
      EXCLUDE USING GIST (
        "tenantId" WITH =,
        "venueId" WITH =,
        ts_range WITH &&
      )
      WHERE ("status" IN ('temp_hold', 'pending', 'confirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_blackout_overlap'
  ) THEN
    ALTER TABLE "availability_blackouts" ADD CONSTRAINT no_blackout_overlap
      EXCLUDE USING GIST (
        "tenantId" WITH =,
        "venueId" WITH =,
        ts_range WITH &&
      );
  END IF;
END $$;

-- 6) Helpful GIST indexes
CREATE INDEX IF NOT EXISTS idx_bookings_ts_range 
  ON "bookings" USING GIST(ts_range);

CREATE INDEX IF NOT EXISTS idx_blackouts_ts_range 
  ON "availability_blackouts" USING GIST(ts_range);

-- 7) Trigger function to maintain ts_range consistency
CREATE OR REPLACE FUNCTION set_ts_range_from_bounds() 
RETURNS trigger AS $$
BEGIN
  NEW.ts_range := tstzrange(NEW."startTs", NEW."endTs", '[)');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8) Triggers to auto-update ts_range when startTs or endTs change
DROP TRIGGER IF EXISTS trg_set_ts_range_bookings ON "bookings";
CREATE TRIGGER trg_set_ts_range_bookings
BEFORE INSERT OR UPDATE OF "startTs", "endTs" ON "bookings"
FOR EACH ROW EXECUTE FUNCTION set_ts_range_from_bounds();

DROP TRIGGER IF EXISTS trg_set_ts_range_blackouts ON "availability_blackouts";
CREATE TRIGGER trg_set_ts_range_blackouts
BEFORE INSERT OR UPDATE OF "startTs", "endTs" ON "availability_blackouts"
FOR EACH ROW EXECUTE FUNCTION set_ts_range_from_bounds();