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
-- NOTE: Made idempotent with IF NOT EXISTS for branch creation support

BEGIN;

-- ============================================================================
-- Step 1: Add new BIGINT columns for cents (alongside existing DECIMAL)
-- ============================================================================

-- Add columns only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'base_price_cents') THEN
    ALTER TABLE sites ADD COLUMN base_price_cents BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'weekend_price_cents') THEN
    ALTER TABLE sites ADD COLUMN weekend_price_cents BIGINT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'total_amount_cents') THEN
    ALTER TABLE reservations ADD COLUMN total_amount_cents BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'paid_amount_cents') THEN
    ALTER TABLE reservations ADD COLUMN paid_amount_cents BIGINT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'amount_cents') THEN
    ALTER TABLE payments ADD COLUMN amount_cents BIGINT;
  END IF;
END $$;

-- ============================================================================
-- Step 2: Backfill new columns (convert DECIMAL dollars → integer cents)
-- Only backfill if old columns exist (migration may have already completed)
-- ============================================================================

-- Sites: base_price, weekend_price (only if old columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'base_price' AND data_type = 'numeric') THEN
    UPDATE sites SET base_price_cents = ROUND(base_price * 100)::BIGINT WHERE base_price_cents IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'weekend_price' AND data_type = 'numeric') THEN
    UPDATE sites SET weekend_price_cents = ROUND(weekend_price * 100)::BIGINT WHERE weekend_price IS NOT NULL AND weekend_price_cents IS NULL;
  END IF;
END $$;

-- Reservations: total_amount, paid_amount (only if old columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'total_amount' AND data_type = 'numeric') THEN
    UPDATE reservations SET total_amount_cents = ROUND(total_amount * 100)::BIGINT WHERE total_amount_cents IS NULL;
    UPDATE reservations SET paid_amount_cents = ROUND(paid_amount * 100)::BIGINT WHERE paid_amount_cents IS NULL;
  END IF;
END $$;

-- Payments: amount (only if old column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'amount' AND data_type = 'numeric') THEN
    UPDATE payments SET amount_cents = ROUND(amount * 100)::BIGINT WHERE amount_cents IS NULL;
  END IF;
END $$;

-- ============================================================================
-- Step 3: Add NOT NULL constraints (after backfill) - idempotent
-- ============================================================================

-- These are safe to run multiple times (SET NOT NULL is idempotent)
DO $$
BEGIN
  -- Only set NOT NULL if column exists and doesn't already have the constraint
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'base_price_cents' AND is_nullable = 'YES') THEN
    ALTER TABLE sites ALTER COLUMN base_price_cents SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'total_amount_cents' AND is_nullable = 'YES') THEN
    ALTER TABLE reservations ALTER COLUMN total_amount_cents SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'paid_amount_cents' AND is_nullable = 'YES') THEN
    ALTER TABLE reservations ALTER COLUMN paid_amount_cents SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'amount_cents' AND is_nullable = 'YES') THEN
    ALTER TABLE payments ALTER COLUMN amount_cents SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- Step 4: Add check constraints (cents must be non-negative) - idempotent
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_base_price_cents_check') THEN
    ALTER TABLE sites ADD CONSTRAINT sites_base_price_cents_check CHECK (base_price_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_weekend_price_cents_check') THEN
    ALTER TABLE sites ADD CONSTRAINT sites_weekend_price_cents_check CHECK (weekend_price_cents IS NULL OR weekend_price_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_total_amount_cents_check') THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_total_amount_cents_check CHECK (total_amount_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_paid_amount_cents_check') THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_paid_amount_cents_check CHECK (paid_amount_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_cents_check') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_amount_cents_check CHECK (amount_cents >= 0);
  END IF;
END $$;

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
