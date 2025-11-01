-- Drop any legacy triggers/functions that tried to set tsRange
DROP TRIGGER IF EXISTS booking_ts_range_trigger ON "public"."bookings";
DROP TRIGGER IF EXISTS blackout_ts_range_trigger ON "public"."availability_blackouts";
DROP FUNCTION IF EXISTS public.update_booking_ts_range();
DROP FUNCTION IF EXISTS public.set_blackout_tsrange();

-- Recreate tsRange as a stored generated column (no triggers required)
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
  ADD COLUMN IF NOT EXISTS "tsRange"
  tstzrange
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
  ADD COLUMN IF NOT EXISTS "tsRange"
  tstzrange
  GENERATED ALWAYS AS (tstzrange("startTs", "endTs", '[)')) STORED;

-- Optional integrity guard to prevent inverted ranges
ALTER TABLE "public"."bookings"
  ADD CONSTRAINT IF NOT EXISTS bookings_start_before_end
  CHECK ("startTs" < "endTs");

ALTER TABLE "public"."availability_blackouts"
  ADD CONSTRAINT IF NOT EXISTS availability_blackouts_start_before_end
  CHECK ("startTs" < "endTs");
