-- Add reserved_until column to reservations table for checkout timer
-- This enables the "airline-style" countdown timer during checkout
-- NOTE: Made idempotent for branch creation support

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'reserved_until') THEN
    ALTER TABLE reservations ADD COLUMN reserved_until timestamptz;
    COMMENT ON COLUMN reservations.reserved_until IS 'Timestamp when a pending reservation expires (typically 15 minutes from creation). Used for checkout countdown timer.';
  END IF;
END $$;

-- Create index for efficient cleanup queries (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_reservations_reserved_until ON reservations(reserved_until)
WHERE status = 'pending' AND reserved_until IS NOT NULL;
