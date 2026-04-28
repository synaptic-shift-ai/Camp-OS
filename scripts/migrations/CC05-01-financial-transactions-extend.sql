-- ============================================================================
-- CC05-01: Extend financial_transactions for unified financial ledger
-- Date: 2026-04-28
-- Description: Adds charge type, Stripe idempotency, void support, charge
--   source tracking, guest linking, refund handling, and recognition status.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Add 'charge' to type CHECK constraint
--    The existing constraint is named 'valid_transaction_type' (created in
--    20250115000000_create_financial_schema.sql). We drop and recreate it
--    to include the new 'charge' type.
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions
  DROP CONSTRAINT valid_transaction_type,
  ADD CONSTRAINT valid_transaction_type
    CHECK (type IN (
      'payment','refund','deposit','deposit_release','deposit_deduction',
      'expense','platform_fee','payout','charge'
    ));

-- ----------------------------------------------------------------------------
-- 2. Stripe webhook idempotency
--    processor_event_id stores the Stripe event ID so we can deduplicate
--    webhook deliveries. The partial unique index ensures one transaction
--    per processor event + type combination.
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions
  ADD COLUMN processor_event_id VARCHAR(255);

CREATE UNIQUE INDEX idx_financial_transactions_processor_event_type
  ON financial_transactions (processor_event_id, type)
  WHERE processor_event_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Void support
--    is_voided marks a transaction as voided (e.g., a reversed charge or
--    cancelled refund). Default is false — existing rows remain active.
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions
  ADD COLUMN is_voided BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 4. Charge source tracking
--    'source' indicates the origin of a transaction (e.g., 'reservation',
--    'manual', 'system'). Default is 'reservation' to match existing data.
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions
  ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'reservation';

CREATE INDEX idx_financial_transactions_source
  ON financial_transactions (source);

-- ----------------------------------------------------------------------------
-- 5. Guest linking
--    Links a transaction directly to a guest record, enabling guest-level
--    financial history without joining through reservations.
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions
  ADD COLUMN guest_id UUID REFERENCES guests(id);

CREATE INDEX idx_financial_transactions_guest_id
  ON financial_transactions (guest_id);

-- ----------------------------------------------------------------------------
-- 6. Refund handling (conditional CHECK)
--    Only refund-type transactions can specify a handling method. The CHECK
--    enforces that handling is NULL for all non-refund types, and when set
--    on a refund it must be one of the allowed values.
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions
  ADD COLUMN handling VARCHAR(50) CHECK (
    type != 'refund' OR handling IS NULL OR handling IN ('original_method', 'guest_credit')
  );

-- ----------------------------------------------------------------------------
-- 7. Charge recognition status (with DB-level CHECK)
--    Tracks revenue recognition state for charges: pending (awaiting
--    recognition), recognized (booked), deferred (postponed), written_off.
--    Default 'recognized' ensures existing rows are treated as recognized.
-- ----------------------------------------------------------------------------
ALTER TABLE financial_transactions
  ADD COLUMN recognition_status VARCHAR(20) NOT NULL DEFAULT 'recognized'
    CHECK (recognition_status IN ('pending', 'recognized', 'deferred', 'written_off'));

CREATE INDEX idx_financial_transactions_recognition_status
  ON financial_transactions (recognition_status);

COMMIT;
