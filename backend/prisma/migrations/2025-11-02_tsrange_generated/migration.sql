-- Fix for PostgreSQL syntax compatibility with Supabase
-- Drop any legacy triggers/functions that tried to set tsRange
DROP TRIGGER IF EXISTS booking_ts_range_trigger ON "public"."bookings";
DROP TRIGGER IF EXISTS blackout_ts_range_trigger ON "public"."availability_blackouts";
DROP FUNCTION IF EXISTS public.update_booking_ts_range();
DROP FUNCTION IF EXISTS public.set_blackout_tsrange();

-- Recreate tsRange as a stored generated column (compatible with Supabase PostgreSQL)
-- Bookings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'tsRange'
      AND generation_expression IS NULL
  ) THEN
    ALTER TABLE "public"."bookings" DROP COLUMN "tsRange";
  END IF;
END$$;

ALTER TABLE "public"."bookings"
  ADD COLUMN "tsRange" tstzrange
  GENERATED ALWAYS AS (tstzrange("startTs", "endTs", '[)')) STORED;

-- Availability blackouts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'availability_blackouts'
      AND column_name = 'tsRange'
      AND generation_expression IS NULL
  ) THEN
    ALTER TABLE "public"."availability_blackouts" DROP COLUMN "tsRange";
  END IF;
END$$;

ALTER TABLE "public"."availability_blackouts"
  ADD COLUMN "tsRange" tstzrange
  GENERATED ALWAYS AS (tstzrange("startTs", "endTs", '[)')) STORED;

-- Add integrity constraints to prevent inverted ranges
ALTER TABLE "public"."bookings"
  ADD CONSTRAINT bookings_start_before_end
  CHECK ("startTs" < "endTs");

ALTER TABLE "public"."availability_blackouts"
  ADD CONSTRAINT availability_blackouts_start_before_end
  CHECK ("startTs" < "endTs");

-- Create GiST indexes for efficient range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_tsrange
  ON "public"."bookings" USING GIST ("tsRange");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blackouts_tsrange
  ON "public"."availability_blackouts" USING GIST ("tsRange");