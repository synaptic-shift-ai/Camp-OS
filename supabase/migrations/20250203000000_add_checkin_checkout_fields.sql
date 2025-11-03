-- Migration: Add Check-in/Check-out Workflow Fields
--
-- Purpose: Add fields to support structured check-in/check-out workflows:
--          - Timestamp and user tracking for check-in/check-out actions
--          - Payment balance collection at check-in
--          - Damage inspection data at check-out
--          - Notes for both workflows
--
-- This supports the full guest lifecycle:
-- confirmed → checked_in (with payment) → checked_out (with inspection) → archived

BEGIN;

-- ============================================================================
-- Step 1: Add check-in fields to reservations table
-- ============================================================================

-- Check-in timestamp (when guest actually checked in)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN reservations.checked_in_at IS
'Timestamp when guest actually checked in. Set when reservation status changes from confirmed to checked_in.';

-- User who performed check-in
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS checked_in_by UUID NULL;

COMMENT ON COLUMN reservations.checked_in_by IS
'User ID of staff member who performed the check-in. Foreign key to auth.users.';

-- Balance paid at check-in (if additional payment collected)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS balance_paid_at_checkin INTEGER NULL DEFAULT 0;

COMMENT ON COLUMN reservations.balance_paid_at_checkin IS
'Additional payment amount collected at check-in time (in cents). Used when deposit was paid earlier but balance due at arrival.';

-- Check-in notes (staff observations)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS check_in_notes TEXT NULL;

COMMENT ON COLUMN reservations.check_in_notes IS
'Optional notes recorded by staff during check-in process. Used for special circumstances, guest requests, or observations.';

-- ============================================================================
-- Step 2: Add check-out fields to reservations table
-- ============================================================================

-- Check-out timestamp (when guest actually checked out)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN reservations.checked_out_at IS
'Timestamp when guest actually checked out. Set when reservation status changes from checked_in to checked_out.';

-- User who performed check-out
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS checked_out_by UUID NULL;

COMMENT ON COLUMN reservations.checked_out_by IS
'User ID of staff member who performed the check-out. Foreign key to auth.users.';

-- Damage inspection data (structured JSON)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS damage_inspection_data JSONB NULL;

COMMENT ON COLUMN reservations.damage_inspection_data IS
'Structured damage inspection data collected during check-out. JSON format:
{
  "site_condition": "excellent" | "good" | "fair" | "poor",
  "equipment_status": "all_present" | "missing_items" | "damaged",
  "cleanliness": "clean" | "needs_cleaning" | "excessive_mess",
  "damage_description": "string (optional)",
  "estimated_repair_cost": number (in cents, optional),
  "inspected_at": "ISO 8601 timestamp",
  "photos": ["url1", "url2"] (optional)
}';

-- Check-out notes (staff observations)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS check_out_notes TEXT NULL;

COMMENT ON COLUMN reservations.check_out_notes IS
'Optional notes recorded by staff during check-out process. Used for damage reports, final charges, or other observations.';

-- ============================================================================
-- Step 3: Add indexes for common queries
-- ============================================================================

-- Index for finding reservations by check-in date (for "Today's Arrivals" queries)
CREATE INDEX IF NOT EXISTS idx_reservations_check_in_date
ON reservations(check_in_date)
WHERE status = 'confirmed';

-- Index for finding reservations by check-out date (for "Today's Departures" queries)
CREATE INDEX IF NOT EXISTS idx_reservations_check_out_date
ON reservations(check_out_date)
WHERE status = 'checked_in';

-- Index for audit trail queries (who performed check-in/out)
CREATE INDEX IF NOT EXISTS idx_reservations_checked_in_by
ON reservations(checked_in_by)
WHERE checked_in_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_checked_out_by
ON reservations(checked_out_by)
WHERE checked_out_by IS NOT NULL;

-- ============================================================================
-- Step 4: Add foreign key constraints
-- ============================================================================

-- Note: We're not adding FK constraints to auth.users because:
-- 1. It's in a different schema (auth vs public)
-- 2. Supabase RLS policies handle access control
-- 3. Application logic validates user IDs
-- If needed in future, add:
-- ALTER TABLE reservations ADD CONSTRAINT fk_checked_in_by
--   FOREIGN KEY (checked_in_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;

-- ============================================================================
-- Post-migration verification:
-- ============================================================================
-- Run these queries to verify the migration:
--
-- 1. Check new columns exist:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'reservations'
-- AND column_name IN (
--   'checked_in_at', 'checked_in_by',
--   'checked_out_at', 'checked_out_by',
--   'balance_paid_at_checkin', 'damage_inspection_data',
--   'check_in_notes', 'check_out_notes'
-- );
--
-- 2. Check indexes were created:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'reservations'
-- AND indexname LIKE 'idx_reservations_%';
--
-- 3. Verify existing data is unaffected:
-- SELECT COUNT(*) as total_reservations,
--        COUNT(checked_in_at) as with_checkin_timestamp,
--        COUNT(checked_out_at) as with_checkout_timestamp
-- FROM reservations;
-- (Should show: total_reservations > 0, timestamps = 0 for existing data)
