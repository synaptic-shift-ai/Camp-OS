-- Migration: Convert money from DECIMAL(10,2) to BIGINT (integer cents)
-- Phase 2a: Money Migration
--
-- IMPORTANT:
-- - Run during maintenance window (involves data conversion)
-- - Backup database before running
-- - After applying, run: npm run gen:db
-- - Test dual-read/dual-write before dropping old columns
--
-- Strategy: Add new columns → backfill → validate → switch code → drop old

BEGIN;

-- ============================================================================
-- Step 1: Add new BIGINT columns for cents (alongside existing DECIMAL)
-- ============================================================================

ALTER TABLE sites
  ADD COLUMN base_price_cents BIGINT,
  ADD COLUMN weekend_price_cents BIGINT;

ALTER TABLE reservations
  ADD COLUMN total_amount_cents BIGINT,
  ADD COLUMN paid_amount_cents BIGINT;

ALTER TABLE payments
  ADD COLUMN amount_cents BIGINT;

-- ============================================================================
-- Step 2: Backfill new columns (convert DECIMAL dollars → integer cents)
-- ============================================================================

-- Sites: base_price, weekend_price
UPDATE sites
SET base_price_cents = ROUND(base_price * 100)::BIGINT;

UPDATE sites
SET weekend_price_cents = ROUND(weekend_price * 100)::BIGINT
WHERE weekend_price IS NOT NULL;

-- Reservations: total_amount, paid_amount
UPDATE reservations
SET total_amount_cents = ROUND(total_amount * 100)::BIGINT,
    paid_amount_cents = ROUND(paid_amount * 100)::BIGINT;

-- Payments: amount
UPDATE payments
SET amount_cents = ROUND(amount * 100)::BIGINT;

-- ============================================================================
-- Step 3: Add NOT NULL constraints (after backfill)
-- ============================================================================

ALTER TABLE sites
  ALTER COLUMN base_price_cents SET NOT NULL;

ALTER TABLE reservations
  ALTER COLUMN total_amount_cents SET NOT NULL,
  ALTER COLUMN paid_amount_cents SET NOT NULL;

ALTER TABLE payments
  ALTER COLUMN amount_cents SET NOT NULL;

-- ============================================================================
-- Step 4: Add check constraints (cents must be non-negative)
-- ============================================================================

ALTER TABLE sites
  ADD CONSTRAINT sites_base_price_cents_check CHECK (base_price_cents >= 0),
  ADD CONSTRAINT sites_weekend_price_cents_check CHECK (weekend_price_cents IS NULL OR weekend_price_cents >= 0);

ALTER TABLE reservations
  ADD CONSTRAINT reservations_total_amount_cents_check CHECK (total_amount_cents >= 0),
  ADD CONSTRAINT reservations_paid_amount_cents_check CHECK (paid_amount_cents >= 0);

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_cents_check CHECK (amount_cents >= 0);

COMMIT;

-- ============================================================================
-- PAUSE HERE - Deploy Phase 2b code with dual-read/dual-write
-- ============================================================================
-- After this migration:
-- 1. npm run gen:db  (regenerate types to include *_cents columns)
-- 2. Deploy Phase 2b code (dual-read/dual-write using src/compat/money.ts)
-- 3. Monitor for 1 week - ensure no errors
-- 4. Run verification queries (below)
-- 5. Proceed to Phase 2c (drop old columns)

-- ============================================================================
-- Verification Queries (run before Phase 2c)
-- ============================================================================

-- Check for discrepancies between old and new columns
SELECT
  'sites' as table_name,
  COUNT(*) as mismatches
FROM sites
WHERE ABS(ROUND(base_price * 100) - base_price_cents) > 1;
-- Should return 0 mismatches

SELECT
  'reservations' as table_name,
  COUNT(*) as mismatches
FROM reservations
WHERE ABS(ROUND(total_amount * 100) - total_amount_cents) > 1;
-- Should return 0 mismatches

-- ============================================================================
-- Phase 2c: Drop old DECIMAL columns (IRREVERSIBLE - run after validation)
-- ============================================================================

-- STOP: Only run this after Phase 2b code is deployed and validated!

-- BEGIN;

-- ALTER TABLE sites
--   DROP COLUMN base_price,
--   DROP COLUMN weekend_price;

-- ALTER TABLE reservations
--   DROP COLUMN total_amount,
--   DROP COLUMN paid_amount;

-- ALTER TABLE payments
--   DROP COLUMN amount;

-- -- Rename *_cents columns to original names
-- ALTER TABLE sites
--   RENAME COLUMN base_price_cents TO base_price,
--   RENAME COLUMN weekend_price_cents TO weekend_price;

-- ALTER TABLE reservations
--   RENAME COLUMN total_amount_cents TO total_amount;

-- ALTER TABLE reservations
--   RENAME COLUMN paid_amount_cents TO paid_amount;

-- ALTER TABLE payments
--   RENAME COLUMN amount_cents TO amount;

-- COMMIT;

-- After Phase 2c:
-- - npm run gen:db (types now show base_price as BIGINT, not DECIMAL)
-- - Remove dual-read/dual-write code
-- - Remove src/compat/money.ts (no longer needed)
-- - Update @/contracts/booking.ts: MoneyAmount → MoneyCents branded type
