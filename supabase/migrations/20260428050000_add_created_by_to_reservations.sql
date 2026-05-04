-- CCxx: Add created_by to reservations (for ledger auditing)
-- Purpose:
-- - Dual-write to financial_transactions requires a valid UUID for created_by.
-- - Guest booking flow needs a consistent "created by" user id to attribute system-created payments.
--
-- This migration is idempotent for Supabase branch support.

BEGIN;

-- 1) Add column (nullable initially for safe rollout)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE reservations
      ADD COLUMN created_by UUID;
  END IF;
END $$;

-- 2) Backfill existing rows from property owner when missing
--    (guest-created reservations have no authenticated user, so owner attribution is safest default)
UPDATE reservations r
SET created_by = p.owner_id
FROM properties p
WHERE r.created_by IS NULL
  AND r.property_id IS NOT NULL
  AND p.id = r.property_id
  AND p.owner_id IS NOT NULL;

-- 3) Index for audit/filter queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_reservations_created_by'
  ) THEN
    CREATE INDEX idx_reservations_created_by ON reservations(created_by);
  END IF;
END $$;

COMMIT;

