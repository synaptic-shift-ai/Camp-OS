-- Migration: Finalize Money Migration - Drop old DECIMAL columns and rename BIGINT columns
-- Phase 2c: Money Migration Final Step
--
-- IMPORTANT:
-- - This is IRREVERSIBLE - only run after Phase 2b validation
-- - Backup database before running
-- - After applying, run: npm run gen:db
-- - Remove dual-read/dual-write code after this migration
--
-- Prerequisites:
-- - Phase 2a completed (added *_cents columns)
-- - Phase 2b code deployed (dual-read/dual-write)
-- - Verification queries confirm 0 mismatches
-- - Production monitoring shows no issues

BEGIN;

-- ============================================================================
-- Step 1: Drop old DECIMAL columns (must complete before renaming)
-- ============================================================================

-- Sites table
ALTER TABLE sites DROP COLUMN IF EXISTS base_price CASCADE;
ALTER TABLE sites DROP COLUMN IF EXISTS weekend_price CASCADE;

-- Reservations table
ALTER TABLE reservations DROP COLUMN IF EXISTS total_amount CASCADE;
ALTER TABLE reservations DROP COLUMN IF EXISTS paid_amount CASCADE;

-- Payments table
ALTER TABLE payments DROP COLUMN IF EXISTS amount CASCADE;

-- ============================================================================
-- Step 2: Rename *_cents columns to original names
-- ============================================================================

-- Sites table
ALTER TABLE sites RENAME COLUMN base_price_cents TO base_price;
ALTER TABLE sites RENAME COLUMN weekend_price_cents TO weekend_price;

-- Reservations table
ALTER TABLE reservations RENAME COLUMN total_amount_cents TO total_amount;
ALTER TABLE reservations RENAME COLUMN paid_amount_cents TO paid_amount;

-- Payments table
ALTER TABLE payments RENAME COLUMN amount_cents TO amount;

COMMIT;

-- ============================================================================
-- After Phase 2c:
-- ============================================================================
-- 1. npm run gen:db (types now show base_price as BIGINT, not DECIMAL)
-- 2. Remove dual-read/dual-write code from:
--    - app/api/booking/create-payment-intent/route.ts
--    - lib/booking/reservation.ts
-- 3. Remove src/compat/money.ts (no longer needed)
-- 4. Update @/contracts/booking.ts: MoneyAmount → MoneyCents branded type
-- 5. Update all money handling to work directly with integer cents
