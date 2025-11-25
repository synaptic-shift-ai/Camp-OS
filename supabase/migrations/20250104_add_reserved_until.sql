-- Add reserved_until column to reservations table for checkout timer
-- This enables the "airline-style" countdown timer during checkout
-- Note: Column may already exist from baseline migration

ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

COMMENT ON COLUMN reservations.reserved_until IS 'Timestamp when a pending reservation expires (typically 15 minutes from creation). Used for checkout countdown timer.';

-- Create index for efficient cleanup queries (skip if exists)
CREATE INDEX IF NOT EXISTS idx_reservations_reserved_until ON reservations(reserved_until)
WHERE status = 'pending' AND reserved_until IS NOT NULL;
