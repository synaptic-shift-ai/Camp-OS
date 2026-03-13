-- Add cancellation policy configuration to properties table
-- Structured config for refund tiers, deadlines, and fees (complements cancellation_policy text).
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS cancellation_policy_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN properties.cancellation_policy_config IS
  'Structured cancellation policy config. Structure is app-defined (e.g. refund_tiers, cancellation_fee_type, deadlines). Complements cancellation_policy text column.';
