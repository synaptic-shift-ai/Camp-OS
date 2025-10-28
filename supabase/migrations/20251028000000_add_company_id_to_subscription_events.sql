-- Add company_id column to subscription_events table
-- Subscription events are company-level (billing entity), not property-level

-- Add company_id column (nullable for backward compatibility)
ALTER TABLE subscription_events
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Make property_id nullable (since we'll use company_id for company-level events)
ALTER TABLE subscription_events
ALTER COLUMN property_id DROP NOT NULL;

-- Add check constraint to ensure at least one of property_id or company_id is set
ALTER TABLE subscription_events
ADD CONSTRAINT subscription_events_entity_check
CHECK (property_id IS NOT NULL OR company_id IS NOT NULL);

-- Add index on company_id for better query performance
CREATE INDEX idx_subscription_events_company_id ON subscription_events(company_id);

-- Add helpful comment
COMMENT ON COLUMN subscription_events.company_id IS 'Company ID for company-level subscription events (billing, payments)';
COMMENT ON COLUMN subscription_events.property_id IS 'Property ID for property-specific events (optional)';
