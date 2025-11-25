-- Migration: Add 'reserved' and 'booked' to site status CHECK constraint
-- NOTE: Made idempotent for branch creation support
-- Description: Updates the sites.status CHECK constraint to include the full
--              booking lifecycle: available → reserved → booked → occupied → housekeeping
-- Author: System
-- Date: 2025-02-03

BEGIN;

-- ============================================================================
-- Step 1: Drop existing CHECK constraint
-- ============================================================================

ALTER TABLE sites
DROP CONSTRAINT IF EXISTS sites_status_valid;

-- ============================================================================
-- Step 2: Add updated CHECK constraint with all 7 status values (idempotent)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_status_valid') THEN
    ALTER TABLE sites
    ADD CONSTRAINT sites_status_valid
    CHECK (status IN (
      'available',    -- Ready for booking
      'reserved',     -- Reservation placed, pending confirmation
      'booked',       -- Confirmed reservation, awaiting check-in
      'occupied',     -- Guest currently staying
      'housekeeping', -- Cleaning after checkout
      'maintenance',  -- Under repair/maintenance
      'unavailable'   -- Blocked or not usable
    ));
  END IF;
END $$;

-- ============================================================================
-- Step 3: Update documentation
-- ============================================================================

COMMENT ON COLUMN sites.status IS
'Current operational status of the site. Full lifecycle: available → reserved → booked → occupied → housekeeping → available. Maintenance and unavailable can happen at any time.';

-- ============================================================================
-- Step 4: Validation
-- ============================================================================

-- Verify constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sites_status_valid'
  ) THEN
    RAISE EXCEPTION 'CHECK constraint sites_status_valid was not created';
  END IF;

  RAISE NOTICE 'Migration completed successfully. Site status now supports 7 values.';
END $$;

COMMIT;
