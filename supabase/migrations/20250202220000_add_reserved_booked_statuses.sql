-- Migration: Add Reserved and Booked Site Statuses
--
-- Purpose: Expand site status values to include pre-check-in states:
--          - reserved: Reservation created, awaiting confirmation or payment
--          - booked: Confirmed reservation, ready for check-in
--
-- This supports the full reservation lifecycle:
-- available → reserved → booked → occupied → housekeeping → available

BEGIN;

-- ============================================================================
-- Step 1: Drop existing CHECK constraint
-- ============================================================================

-- Drop the constraint that limits to 5 values
ALTER TABLE sites
DROP CONSTRAINT IF EXISTS sites_status_valid;

-- ============================================================================
-- Step 2: Add new CHECK constraint with all 7 statuses
-- ============================================================================

ALTER TABLE sites
ADD CONSTRAINT sites_status_valid
CHECK (status IN (
  'available',
  'reserved',
  'booked',
  'occupied',
  'housekeeping',
  'maintenance',
  'unavailable'
));

-- ============================================================================
-- Step 3: Update documentation
-- ============================================================================

COMMENT ON COLUMN sites.status IS
'Site operational status. Valid values:
- available: Ready for booking
- reserved: Reservation placed, pending confirmation
- booked: Confirmed reservation, awaiting check-in
- occupied: Guest currently staying
- housekeeping: Cleaning after checkout
- maintenance: Under repair/maintenance
- unavailable: Blocked or not usable';

COMMIT;

-- ============================================================================
-- Post-migration verification:
-- ============================================================================
-- Run this query to verify all sites have valid status values:
-- SELECT DISTINCT status FROM sites ORDER BY status;
--
-- Expected output may include:
-- - available
-- - booked (if any reservations)
-- - housekeeping (if any sites being cleaned)
-- - maintenance (if any sites under repair)
-- - occupied (if any current guests)
-- - reserved (if any pending reservations)
-- - unavailable (if any blocked sites)
