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

-- Step 1: Add new columns for workflow tracking
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES property_staff(user_id),
ADD COLUMN IF NOT EXISTS balance_paid_at_check_in_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS check_in_notes TEXT,
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS checked_out_by UUID REFERENCES property_staff(user_id),
ADD COLUMN IF NOT EXISTS has_damages BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS check_out_notes TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER DEFAULT 0;

-- Step 2: Add new money columns (in cents)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER,
ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER DEFAULT 0;

-- Step 3: Migrate existing money data (DECIMAL to cents)
-- Only run if the old columns still exist and new columns are empty
UPDATE reservations
SET total_amount_cents = (total_amount * 100)::INTEGER,
    paid_amount_cents = (paid_amount * 100)::INTEGER
WHERE total_amount_cents IS NULL;

-- Step 4: Make new money columns NOT NULL after migration
ALTER TABLE reservations
ALTER COLUMN total_amount_cents SET NOT NULL,
ALTER COLUMN paid_amount_cents SET NOT NULL;

-- Step 5: Drop old DECIMAL columns (after data migration complete)
-- Commented out for safety - uncomment after verifying migration
-- ALTER TABLE reservations DROP COLUMN IF EXISTS total_amount;
-- ALTER TABLE reservations DROP COLUMN IF EXISTS paid_amount;

-- Step 6: Update status enum to include 'completed'
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations
ADD CONSTRAINT reservations_status_check
CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show'));

-- Step 7: Update payment_status enum to use domain model values
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS reservations_payment_status_check;

ALTER TABLE reservations
ADD CONSTRAINT reservations_payment_status_check
CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded'));

-- Update existing 'unpaid' to 'pending' for consistency
UPDATE reservations
SET payment_status = 'pending'
WHERE payment_status = 'unpaid';

-- Step 8: Add indexes for common queries
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
