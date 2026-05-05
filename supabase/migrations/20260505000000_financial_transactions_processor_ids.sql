-- Add generic processor ID columns to financial_transactions.
-- Existing stripe_payment_intent_id and stripe_refund_id columns are kept
-- for backward compatibility. The new columns are processor-agnostic.

ALTER TABLE financial_transactions
  ADD COLUMN processor_payment_id VARCHAR(255),
  ADD COLUMN processor_charge_id VARCHAR(255),
  ADD COLUMN processor_payment_method_id VARCHAR(255);

-- Index for lookups by processor payment ID (e.g., Stripe PaymentIntent idempotency)
CREATE INDEX idx_financial_transactions_processor_payment_id
  ON financial_transactions (processor_payment_id)
  WHERE processor_payment_id IS NOT NULL;
