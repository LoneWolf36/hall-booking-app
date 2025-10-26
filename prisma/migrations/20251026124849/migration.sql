/*
  Warnings:

  - You are about to drop the column `ts_range` on the `availability_blackouts` table. All the data in the column will be lost.
  - You are about to drop the column `ts_range` on the `bookings` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."idx_blackouts_ts_range";

-- DropIndex
DROP INDEX "public"."idx_bookings_ts_range";

-- AlterTable
ALTER TABLE "availability_blackouts" DROP COLUMN "ts_range";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "ts_range";
