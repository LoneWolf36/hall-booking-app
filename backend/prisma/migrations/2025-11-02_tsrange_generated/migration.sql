-- Compatible migration: triggers + constraints without "IF NOT EXISTS" keywords to satisfy strict parsers

-- 1) Drop existing artifacts if present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='tsRange'
  ) THEN
    ALTER TABLE "public"."bookings" DROP COLUMN "tsRange";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='availability_blackouts' AND column_name='tsRange'
  ) THEN
    ALTER TABLE "public"."availability_blackouts" DROP COLUMN "tsRange";
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- ignore
END $$;

-- 2) Add plain tstzrange columns
ALTER TABLE "public"."bookings" ADD COLUMN "tsRange" tstzrange;
ALTER TABLE "public"."availability_blackouts" ADD COLUMN "tsRange" tstzrange;

-- 3) Upsert trigger functions
CREATE OR REPLACE FUNCTION public.set_booking_tsrange() RETURNS trigger AS $$
BEGIN
  NEW."tsRange" := tstzrange(NEW."startTs", NEW."endTs", '[)');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_blackout_tsrange() RETURNS trigger AS $$
BEGIN
  NEW."tsRange" := tstzrange(NEW."startTs", NEW."endTs", '[)');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- 4) Recreate triggers
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid
    WHERE t.tgname='booking_ts_range_trigger' AND n.nspname='public' AND c.relname='bookings'
  ) THEN
    DROP TRIGGER booking_ts_range_trigger ON "public"."bookings";
  END IF;
  CREATE TRIGGER booking_ts_range_trigger
  BEFORE INSERT OR UPDATE OF "startTs", "endTs" ON "public"."bookings"
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_tsrange();
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid
    WHERE t.tgname='blackout_ts_range_trigger' AND n.nspname='public' AND c.relname='availability_blackouts'
  ) THEN
    DROP TRIGGER blackout_ts_range_trigger ON "public"."availability_blackouts";
  END IF;
  CREATE TRIGGER blackout_ts_range_trigger
  BEFORE INSERT OR UPDATE OF "startTs", "endTs" ON "public"."availability_blackouts"
  FOR EACH ROW EXECUTE FUNCTION public.set_blackout_tsrange();
END $$;

-- 5) Constraints (create only if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='bookings_start_before_end'
  ) THEN
    ALTER TABLE "public"."bookings" ADD CONSTRAINT bookings_start_before_end CHECK ("startTs" < "endTs");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='availability_blackouts_start_before_end'
  ) THEN
    ALTER TABLE "public"."availability_blackouts" ADD CONSTRAINT availability_blackouts_start_before_end CHECK ("startTs" < "endTs");
  END IF;
END $$;

-- 6) Indexes (create only if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='idx_bookings_tsrange' AND n.nspname='public'
  ) THEN
    CREATE INDEX idx_bookings_tsrange ON "public"."bookings" USING GIST ("tsRange");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='idx_blackouts_tsrange' AND n.nspname='public'
  ) THEN
    CREATE INDEX idx_blackouts_tsrange ON "public"."availability_blackouts" USING GIST ("tsRange");
  END IF;
END $$;
