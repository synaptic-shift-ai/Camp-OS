-- ============================================================================
-- URGENT FIX: Add 'reserved' and 'booked' to site status constraint
-- ============================================================================
--
-- PROBLEM: The availability search is broken because the database CHECK
--          constraint only allows 5 status values, but the TypeScript code
--          expects 7 status values (including 'reserved' and 'booked').
--
-- SOLUTION: Run this SQL in your Supabase SQL Editor immediately.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--
-- ============================================================================

BEGIN;

-- Drop old constraint
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_status_valid;

-- Add new constraint with all 7 statuses
ALTER TABLE sites
ADD CONSTRAINT sites_status_valid
CHECK (status IN (
  'available',    -- Ready for booking
  'reserved',     -- Reservation placed, pending confirmation (NEW)
  'booked',       -- Confirmed reservation, awaiting check-in (NEW)
  'occupied',     -- Guest currently staying
  'housekeeping', -- Cleaning after checkout
  'maintenance',  -- Under repair/maintenance
  'unavailable'   -- Blocked or not usable
));

-- Update documentation
COMMENT ON COLUMN sites.status IS
'Current operational status of the site. Full lifecycle: available → reserved → booked → occupied → housekeeping → available. Maintenance and unavailable can happen at any time.';

COMMIT;

-- Verify it worked
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'sites_status_valid';
