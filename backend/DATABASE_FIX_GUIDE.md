# Database Migration Fix Guide

## Problem
The Prisma migration `2025-11-02_tsrange_generated` is failing with a PostgreSQL syntax error when trying to create generated columns for `tsRange` fields.

**Error**: `ERROR: syntax error at or near "NOT"`

## Root Cause
The issue is with PostgreSQL version compatibility between the generated migration syntax and Supabase's PostgreSQL version. The `IF NOT EXISTS` clause in combination with generated columns might not be supported in the same way.

## Solution Options

### Option 1: Reset and Recreate (Recommended for Development)

```bash
# 1. Reset the database completely
npx prisma migrate reset --force

# 2. Regenerate and apply migrations
npx prisma db push

# 3. Generate Prisma client
npx prisma generate

# 4. Seed the database
npx prisma db seed
```

### Option 2: Manual Database Fix (If you have existing data)

```sql
-- Connect to your Supabase database and run these commands manually:

-- 1. Drop problematic columns if they exist
ALTER TABLE "public"."bookings" DROP COLUMN IF EXISTS "tsRange";
ALTER TABLE "public"."availability_blackouts" DROP COLUMN IF EXISTS "tsRange";

-- 2. Add generated columns (simplified syntax)
ALTER TABLE "public"."bookings"
  ADD COLUMN "tsRange" tstzrange
  GENERATED ALWAYS AS (tstzrange("startTs", "endTs", '[)')) STORED;

ALTER TABLE "public"."availability_blackouts"
  ADD COLUMN "tsRange" tstzrange
  GENERATED ALWAYS AS (tstzrange("startTs", "endTs", '[)')) STORED;

-- 3. Add constraints
ALTER TABLE "public"."bookings"
  ADD CONSTRAINT bookings_start_before_end
  CHECK ("startTs" < "endTs");

ALTER TABLE "public"."availability_blackouts"
  ADD CONSTRAINT availability_blackouts_start_before_end
  CHECK ("startTs" < "endTs");

-- 4. Create indexes for performance
CREATE INDEX idx_bookings_tsrange
  ON "public"."bookings" USING GIST ("tsRange");

CREATE INDEX idx_blackouts_tsrange
  ON "public"."availability_blackouts" USING GIST ("tsRange");
```

### Option 3: Disable Generated Columns (Quick Fix)

If the generated columns are causing too many issues, you can temporarily disable them:

1. Edit `prisma/schema.prisma`
2. Comment out or remove the `tsRange` fields:

```prisma
model Booking {
  // ... other fields
  startTs                    DateTime
  endTs                      DateTime
  // tsRange                    Unsupported("tstzrange")? // Temporarily disabled
  // ... rest of the model
}

model Blackout {
  // ... other fields
  startTs       DateTime
  endTs         DateTime
  // tsRange       Unsupported("tstzrange")? // Temporarily disabled
  // ... rest of the model
}
```

3. Create a new migration:
```bash
npx prisma migrate dev --name disable_tsrange_columns
```

## Verification

After applying any of the above solutions, verify that everything works:

```bash
# 1. Check Prisma can connect
npx prisma db pull

# 2. Generate client
npx prisma generate

# 3. Test the application
npm run start:dev
```

## Prevention

To avoid similar issues in the future:

1. **Test migrations locally first** before applying to production
2. **Use simpler PostgreSQL syntax** that's compatible across versions
3. **Consider using database triggers instead of generated columns** for complex logic
4. **Keep migrations small and focused** - don't combine multiple schema changes

## Troubleshooting

If you still encounter issues:

1. **Check PostgreSQL version compatibility**:
   ```sql
   SELECT version();
   ```

2. **Verify tstzrange support**:
   ```sql
   SELECT 'tstzrange'::regtype;
   ```

3. **Check for existing objects**:
   ```sql
   \d+ bookings
   \d+ availability_blackouts
   ```

4. **Clear Prisma cache**:
   ```bash
   npx prisma generate --force-reset
   ```