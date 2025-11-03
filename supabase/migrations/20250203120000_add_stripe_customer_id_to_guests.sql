-- Migration: Add stripe_customer_id to guests table
-- Description: Stores Stripe Customer ID for each guest to enable
--              "Card on File" payment functionality
-- Author: System
-- Date: 2025-02-03

BEGIN;

-- ============================================================================
-- Step 1: Add stripe_customer_id column to guests table
-- ============================================================================

ALTER TABLE guests
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ============================================================================
-- Step 2: Add index for faster Stripe customer lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_guests_stripe_customer_id
ON guests(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- Step 3: Add column documentation
-- ============================================================================

COMMENT ON COLUMN guests.stripe_customer_id IS
'Stripe Customer ID (cus_xxxxx) for this guest. Created on first booking to enable saved payment methods and "Card on File" functionality. NULL for guests who have not yet completed payment.';

-- ============================================================================
-- Step 4: Validation
-- ============================================================================

-- Verify column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'guests'
    AND column_name = 'stripe_customer_id'
  ) THEN
    RAISE EXCEPTION 'Column stripe_customer_id was not created on guests table';
  END IF;

  RAISE NOTICE 'Migration completed successfully. stripe_customer_id column added to guests table.';
END $$;

COMMIT;

-- ============================================================================
-- Usage Notes
-- ============================================================================
--
-- When creating a Stripe Customer during booking:
-- 1. Guest completes booking form
-- 2. Create Stripe Customer: stripe.customers.create({ email, name, metadata })
-- 3. Save customer.id to guests.stripe_customer_id
-- 4. Attach PaymentMethod to customer: stripe.paymentMethods.attach()
-- 5. Set as default: stripe.customers.update({ invoice_settings: { default_payment_method }})
--
-- When retrieving saved cards at check-in:
-- 1. Fetch guest.stripe_customer_id
-- 2. Call stripe.paymentMethods.list({ customer: stripe_customer_id })
-- 3. Display cards with last4, brand, exp_month, exp_year
-- 4. Charge selected payment method
