-- NOTE: Made idempotent for branch creation support
-- Migration: Enhance Reservation Workflow Schema
-- Created: 2025-01-12
-- Purpose: Update reservations table to support complete booking lifecycle
--
-- Changes:
-- 1. Convert money fields from DECIMAL to INTEGER (cents)
-- 2. Add check-in workflow fields
-- 3. Add check-out workflow fields
-- 4. Add cancellation tracking fields
-- 5. Add COMPLETED status
-- 6. Normalize status enum values

-- Step 1: Add new columns for workflow tracking (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'checked_in_at') THEN
    ALTER TABLE reservations ADD COLUMN checked_in_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'checked_in_by') THEN
    ALTER TABLE reservations ADD COLUMN checked_in_by UUID REFERENCES property_staff(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'balance_paid_at_check_in_cents') THEN
    ALTER TABLE reservations ADD COLUMN balance_paid_at_check_in_cents INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'check_in_notes') THEN
    ALTER TABLE reservations ADD COLUMN check_in_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'checked_out_at') THEN
    ALTER TABLE reservations ADD COLUMN checked_out_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'checked_out_by') THEN
    ALTER TABLE reservations ADD COLUMN checked_out_by UUID REFERENCES property_staff(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'has_damages') THEN
    ALTER TABLE reservations ADD COLUMN has_damages BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'check_out_notes') THEN
    ALTER TABLE reservations ADD COLUMN check_out_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'cancellation_reason') THEN
    ALTER TABLE reservations ADD COLUMN cancellation_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'refund_amount_cents') THEN
    ALTER TABLE reservations ADD COLUMN refund_amount_cents INTEGER DEFAULT 0;
  END IF;
END $$;

-- Step 2: Add new money columns (in cents) (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'total_amount_cents') THEN
    ALTER TABLE reservations ADD COLUMN total_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'paid_amount_cents') THEN
    ALTER TABLE reservations ADD COLUMN paid_amount_cents INTEGER DEFAULT 0;
  END IF;
END $$;

-- Step 3: Migrate existing money data (DECIMAL to cents) (idempotent - only if not already migrated)
-- Only run if the old columns still exist and new columns are empty
UPDATE reservations
SET total_amount_cents = (total_amount * 100)::INTEGER,
    paid_amount_cents = (paid_amount * 100)::INTEGER
WHERE total_amount_cents IS NULL
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'total_amount');

-- Step 4: Make new money columns NOT NULL after migration (idempotent)
DO $$
BEGIN
  -- Only set NOT NULL if column exists and all values are populated
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'total_amount_cents' AND is_nullable = 'YES') THEN
    IF NOT EXISTS (SELECT 1 FROM reservations WHERE total_amount_cents IS NULL) THEN
      ALTER TABLE reservations ALTER COLUMN total_amount_cents SET NOT NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'paid_amount_cents' AND is_nullable = 'YES') THEN
    IF NOT EXISTS (SELECT 1 FROM reservations WHERE paid_amount_cents IS NULL) THEN
      ALTER TABLE reservations ALTER COLUMN paid_amount_cents SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Step 5: Drop old DECIMAL columns (after data migration complete)
-- Commented out for safety - uncomment after verifying migration
-- ALTER TABLE reservations DROP COLUMN IF EXISTS total_amount;
-- ALTER TABLE reservations DROP COLUMN IF EXISTS paid_amount;

-- Step 6: Update status enum to include 'completed' (idempotent)
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS reservations_status_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_status_check') THEN
    ALTER TABLE reservations
    ADD CONSTRAINT reservations_status_check
    CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show'));
  END IF;
END $$;

-- Step 7: Update payment_status enum to use domain model values (idempotent)
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS reservations_payment_status_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_payment_status_check') THEN
    ALTER TABLE reservations
    ADD CONSTRAINT reservations_payment_status_check
    CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded'));
  END IF;
END $$;

-- Update existing 'unpaid' to 'pending' for consistency (idempotent - only update if still unpaid)
UPDATE reservations
SET payment_status = 'pending'
WHERE payment_status = 'unpaid';

-- Step 8: Add indexes for common queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_reservations_property_status
ON reservations(property_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_site_dates
ON reservations(site_id, check_in_date, check_out_date);

CREATE INDEX IF NOT EXISTS idx_reservations_check_in_date
ON reservations(check_in_date)
WHERE status IN ('confirmed', 'pending');

CREATE INDEX IF NOT EXISTS idx_reservations_confirmation_number
ON reservations(confirmation_number);

-- Step 9: Add comment documenting the schema
COMMENT ON TABLE reservations IS
'Reservation lifecycle: PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT → COMPLETED
Money stored in cents (INTEGER) to avoid floating-point precision issues.
Check-in workflow: checked_in_at, checked_in_by, balance_paid_at_check_in_cents, check_in_notes
Check-out workflow: checked_out_at, checked_out_by, has_damages, check_out_notes
Cancellation: cancelled_at, cancellation_reason, refund_amount_cents';

COMMENT ON COLUMN reservations.total_amount_cents IS 'Total reservation amount in cents (INTEGER)';
COMMENT ON COLUMN reservations.paid_amount_cents IS 'Amount paid so far in cents (INTEGER)';
COMMENT ON COLUMN reservations.balance_paid_at_check_in_cents IS 'Additional payment made at check-in in cents';
COMMENT ON COLUMN reservations.refund_amount_cents IS 'Refund amount for cancelled reservations in cents';
