-- Add company_id column to subscription_events table
-- NOTE: Made idempotent for branch creation support
-- Subscription events are company-level (billing entity), not property-level

-- Add company_id column (nullable for backward compatibility) - idempotent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_events' AND column_name = 'company_id') THEN
    ALTER TABLE subscription_events ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make property_id nullable (since we'll use company_id for company-level events) - idempotent
-- This is safe to run multiple times
ALTER TABLE subscription_events
ALTER COLUMN property_id DROP NOT NULL;

-- Add check constraint to ensure at least one of property_id or company_id is set (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_events_entity_check') THEN
    ALTER TABLE subscription_events
    ADD CONSTRAINT subscription_events_entity_check
    CHECK (property_id IS NOT NULL OR company_id IS NOT NULL);
  END IF;
END $$;

-- Add index on company_id for better query performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_subscription_events_company_id ON subscription_events(company_id);

-- Add helpful comment
COMMENT ON COLUMN subscription_events.company_id IS 'Company ID for company-level subscription events (billing, payments)';
COMMENT ON COLUMN subscription_events.property_id IS 'Property ID for property-specific events (optional)';
