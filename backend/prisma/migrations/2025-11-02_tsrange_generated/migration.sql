-- Replace generated columns with trigger-based computation to avoid immutability errors on Supabase
-- Safe for PostgreSQL versions that enforce immutable expressions for generated columns

-- 1) Drop generated columns if they exist
ALTER TABLE "public"."bookings" DROP COLUMN IF EXISTS "tsRange";
ALTER TABLE "public"."availability_blackouts" DROP COLUMN IF EXISTS "tsRange";

-- 2) Add plain tstzrange columns (not generated)
ALTER TABLE "public"."bookings" ADD COLUMN IF NOT EXISTS "tsRange" tstzrange;
ALTER TABLE "public"."availability_blackouts" ADD COLUMN IF NOT EXISTS "tsRange" tstzrange;

-- 3) Create functions to keep tsRange in sync
CREATE OR REPLACE FUNCTION public.set_booking_tsrange()
RETURNS trigger AS $$
BEGIN
  NEW."tsRange" := tstzrange(NEW."startTs", NEW."endTs", '[)');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_blackout_tsrange()
RETURNS trigger AS $$
BEGIN
  NEW."tsRange" := tstzrange(NEW."startTs", NEW."endTs", '[)');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Attach triggers for insert/update
DROP TRIGGER IF EXISTS booking_ts_range_trigger ON "public"."bookings";
CREATE TRIGGER booking_ts_range_trigger
BEFORE INSERT OR UPDATE OF "startTs", "endTs" ON "public"."bookings"
FOR EACH ROW EXECUTE FUNCTION public.set_booking_tsrange();

DROP TRIGGER IF EXISTS blackout_ts_range_trigger ON "public"."availability_blackouts";
CREATE TRIGGER blackout_ts_range_trigger
BEFORE INSERT OR UPDATE OF "startTs", "endTs" ON "public"."availability_blackouts"
FOR EACH ROW EXECUTE FUNCTION public.set_blackout_tsrange();

-- 5) Integrity constraints
ALTER TABLE "public"."bookings"
  ADD CONSTRAINT IF NOT EXISTS bookings_start_before_end CHECK ("startTs" < "endTs");
ALTER TABLE "public"."availability_blackouts"
  ADD CONSTRAINT IF NOT EXISTS availability_blackouts_start_before_end CHECK ("startTs" < "endTs");

-- 6) Indexes for range queries
CREATE INDEX IF NOT EXISTS idx_bookings_tsrange ON "public"."bookings" USING GIST ("tsRange");
CREATE INDEX IF NOT EXISTS idx_blackouts_tsrange ON "public"."availability_blackouts" USING GIST ("tsRange");
