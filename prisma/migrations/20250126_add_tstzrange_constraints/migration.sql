-- Add tstzrange columns to bookings and blackouts tables
-- These native PostgreSQL range columns enable atomic overlap detection

-- Add tstzrange column to bookings table
ALTER TABLE "bookings" 
ADD COLUMN "ts_range" TSTZRANGE;

-- Add tstzrange column to blackouts table  
ALTER TABLE "availability_blackouts"
ADD COLUMN "ts_range" TSTZRANGE;

-- Create function to automatically populate ts_range from start/end timestamps
CREATE OR REPLACE FUNCTION update_booking_ts_range()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert startTs and endTs to tstzrange format
  -- Ensures proper timezone handling for Indian time
  NEW.ts_range = tstzrange(
    NEW."startTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
    NEW."endTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
    '[)' -- Left-closed, right-open interval
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function for blackouts ts_range
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

-- Create triggers to automatically update ts_range columns
CREATE TRIGGER booking_ts_range_trigger
  BEFORE INSERT OR UPDATE ON "bookings"
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_ts_range();

CREATE TRIGGER blackout_ts_range_trigger
  BEFORE INSERT OR UPDATE ON "availability_blackouts"
  FOR EACH ROW
  EXECUTE FUNCTION update_blackout_ts_range();

-- Enable GIST extension for range indexing
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create exclusion constraint to prevent overlapping bookings
-- This is the core constraint that prevents double-bookings
ALTER TABLE "bookings" 
ADD CONSTRAINT "no_booking_overlap" 
EXCLUDE USING GIST (
  "tenantId" WITH =,     -- Same tenant
  "venueId" WITH =,      -- Same venue  
  "ts_range" WITH &&     -- Overlapping time ranges
) 
WHERE ("status" IN ('temp_hold', 'pending', 'confirmed'));

-- Create exclusion constraint for blackouts vs bookings
-- Prevents bookings during maintenance/blackout periods
ALTER TABLE "availability_blackouts"
ADD CONSTRAINT "no_blackout_overlap"
EXCLUDE USING GIST (
  "tenantId" WITH =,
  "venueId" WITH =, 
  "ts_range" WITH &&
);

-- Create GIST index for efficient range queries
CREATE INDEX "idx_bookings_ts_range" ON "bookings" 
USING GIST ("tenantId", "venueId", "ts_range");

CREATE INDEX "idx_blackouts_ts_range" ON "availability_blackouts"
USING GIST ("tenantId", "venueId", "ts_range");

-- Update existing data (if any) to populate ts_range columns
UPDATE "bookings" 
SET "ts_range" = tstzrange(
  "startTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
  "endTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
  '[)'
)
WHERE "ts_range" IS NULL;

UPDATE "availability_blackouts"
SET "ts_range" = tstzrange(
  "startTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 
  "endTs" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata',
  '[)'
)
WHERE "ts_range" IS NULL;

-- Add helpful comments for future developers
COMMENT ON COLUMN "bookings"."ts_range" IS 'PostgreSQL native range type for atomic overlap detection';
COMMENT ON CONSTRAINT "no_booking_overlap" ON "bookings" IS 'Prevents double-bookings at database level';
COMMENT ON INDEX "idx_bookings_ts_range" IS 'GIST index for efficient range queries and overlap detection';

/*
Why this approach?

1. **Atomic Operations**: Database-level constraints prevent race conditions
2. **Performance**: GIST indexes make range queries extremely fast
3. **Correctness**: Impossible to have overlapping bookings
4. **Timezone Safety**: Proper handling of Indian timezone (Asia/Kolkata)
5. **Flexibility**: Supports partial-day bookings and complex scheduling

Interval Format: '[)' means:
- '[' = Start time included
- ')' = End time excluded  
- Example: [2025-01-01 10:00, 2025-01-01 18:00) 
  = 10:00 AM to 5:59:59 PM

This prevents edge cases like:
- Booking 1: 10:00-18:00
- Booking 2: 18:00-22:00  
- These don't overlap because first ends exactly when second starts
*/