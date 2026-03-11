-- Migration: Add soft delete support to guests table
-- Guests linked to reservations should not be hard-deleted to preserve data integrity.
-- Setting deleted_at marks a guest as deleted without removing the row.

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index for efficient querying of active (non-deleted) guests
CREATE INDEX IF NOT EXISTS idx_guests_active
  ON guests(property_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN guests.deleted_at IS
  'Soft delete timestamp. NULL = active guest. Non-NULL = deleted, hidden from UI but preserved for FK integrity.';
