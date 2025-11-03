-- Migration: Update Site Status Values
--
-- Purpose: Remove any existing CHECK constraints on sites.status and ensure
--          all 5 status values are accepted:
--          - available
--          - occupied
--          - maintenance
--          - housekeeping
--          - unavailable
--
-- Background: Frontend and API now support 5 statuses, but database may have
--             a CHECK constraint limiting to only 3 original values.

BEGIN;

-- ============================================================================
-- Step 1: Drop any existing CHECK constraints on sites.status
-- ============================================================================

-- Find and drop any constraint named like 'sites_status_check' or similar
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find constraints on the status column
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'sites'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'  -- CHECK constraint
          AND pg_get_constraintdef(con.oid) LIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE sites DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Optionally add a new CHECK constraint with all 5 values
-- ============================================================================

-- Add CHECK constraint to ensure only valid status values
-- (Optional - comment out if you want to allow any status value)
ALTER TABLE sites
DROP CONSTRAINT IF EXISTS sites_status_valid;

ALTER TABLE sites
ADD CONSTRAINT sites_status_valid
CHECK (status IN ('available', 'occupied', 'maintenance', 'housekeeping', 'unavailable'));

-- ============================================================================
-- Step 3: Add documentation
-- ============================================================================

COMMENT ON COLUMN sites.status IS
'Site operational status. Valid values: available, occupied, maintenance, housekeeping, unavailable';

-- ============================================================================
-- Step 4: Update any existing invalid status values (safety measure)
-- ============================================================================

-- If there are any sites with old/invalid status values, update them
-- This prevents constraint violation errors
UPDATE sites
SET status = 'available'
WHERE status NOT IN ('available', 'occupied', 'maintenance', 'housekeeping', 'unavailable')
  AND status IS NOT NULL;

COMMIT;

-- ============================================================================
-- Post-migration verification:
-- ============================================================================
-- Run this query to verify all sites have valid status values:
-- SELECT DISTINCT status FROM sites ORDER BY status;
--
-- Expected output:
-- - available
-- - housekeeping (if any sites use it)
-- - maintenance (if any sites use it)
-- - occupied (if any sites use it)
-- - unavailable (if any sites use it)
