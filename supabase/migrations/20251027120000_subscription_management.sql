-- Add subscription fields to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete')),
ADD COLUMN IF NOT EXISTS subscription_plan TEXT CHECK (subscription_plan IN ('starter', 'growth', 'pro', 'enterprise')),
ADD COLUMN IF NOT EXISTS subscription_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
ADD COLUMN IF NOT EXISTS site_count INTEGER,
ADD COLUMN IF NOT EXISTS monthly_booking_quota INTEGER;

-- Create subscription events table for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_stripe_customer ON properties(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_subscription ON properties(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_subscription_status ON properties(subscription_status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_property ON subscription_events(property_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);

-- RLS policies for subscription_events
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription events"
  ON subscription_events FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON COLUMN properties.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN properties.subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN properties.subscription_status IS 'Current subscription status';
COMMENT ON COLUMN properties.subscription_plan IS 'Plan tier: starter, growth, pro, or enterprise';
COMMENT ON COLUMN properties.billing_cycle IS 'Monthly or annual billing';
COMMENT ON COLUMN properties.site_count IS 'Number of campsites (used for plan validation)';
COMMENT ON COLUMN properties.monthly_booking_quota IS 'Included bookings per month based on plan';
COMMENT ON TABLE subscription_events IS 'Audit trail for all subscription-related events';
