-- Add payment_processor column to properties table.
-- Stores which payment processor the property uses:
-- 'stripe' (default), 'campost_payments', or 'none'.

ALTER TABLE properties
  ADD COLUMN payment_processor TEXT NOT NULL DEFAULT 'stripe'
  CHECK (payment_processor IN ('stripe', 'campost_payments', 'none'));

-- Index for filtering properties by processor type
CREATE INDEX idx_properties_payment_processor
  ON properties (payment_processor);
