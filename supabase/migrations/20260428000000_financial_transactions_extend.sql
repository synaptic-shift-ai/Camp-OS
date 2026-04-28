-- ============================================================================
-- CC05-01b: Extend financial_transactions for unified financial ledger
-- Date: 2026-04-28
-- Description: Idempotent version of CC05-01. Adds charge type, Stripe
--   idempotency, void support, charge source tracking, guest linking,
--   refund handling, and recognition status.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Add 'charge' to type CHECK constraint
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_transaction_type'
  ) THEN
    ALTER TABLE financial_transactions
      DROP CONSTRAINT valid_transaction_type,
      ADD CONSTRAINT valid_transaction_type
        CHECK (type IN (
          'payment','refund','deposit','deposit_release','deposit_deduction',
          'expense','platform_fee','payout','charge'
        ));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Stripe webhook idempotency (processor_event_id)
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS processor_event_id VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_financial_transactions_processor_event_type'
  ) THEN
    CREATE UNIQUE INDEX idx_financial_transactions_processor_event_type
      ON financial_transactions (processor_event_id, type)
      WHERE processor_event_id IS NOT NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Void support (is_voided)
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 4. Charge source tracking (source)
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'reservation';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_financial_transactions_source'
  ) THEN
    CREATE INDEX idx_financial_transactions_source
      ON financial_transactions (source);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Guest linking (guest_id)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_transactions' AND column_name = 'guest_id'
  ) THEN
    ALTER TABLE financial_transactions
      ADD COLUMN guest_id UUID REFERENCES guests(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_financial_transactions_guest_id'
  ) THEN
    CREATE INDEX idx_financial_transactions_guest_id
      ON financial_transactions (guest_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Refund handling
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_transactions' AND column_name = 'handling'
  ) THEN
    ALTER TABLE financial_transactions
      ADD COLUMN handling VARCHAR(50) CHECK (
        handling IS NULL OR (type = 'refund' AND handling IN ('original_method', 'guest_credit'))
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Charge recognition status
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_transactions' AND column_name = 'recognition_status'
  ) THEN
    ALTER TABLE financial_transactions
      ADD COLUMN recognition_status VARCHAR(20) NOT NULL DEFAULT 'recognized'
        CHECK (recognition_status IN ('pending', 'recognized', 'deferred', 'written_off'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_financial_transactions_recognition_status'
  ) THEN
    CREATE INDEX idx_financial_transactions_recognition_status
      ON financial_transactions (recognition_status);
  END IF;
END $$;

COMMIT;
