-- Create companies table for multi-property management
-- Companies represent the legal entity that owns/manages properties and handles billing
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Billing information (moved from properties since billing is at company level)
  stripe_customer_id TEXT UNIQUE,
  subscription_id TEXT UNIQUE,
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete')),
  subscription_plan TEXT CHECK (subscription_plan IN ('starter', 'growth', 'pro', 'enterprise')),
  subscription_created_at TIMESTAMPTZ,
  subscription_canceled_at TIMESTAMPTZ,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add company_id foreign key to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer ON companies(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_subscription ON companies(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_company ON properties(company_id);

-- RLS policies for companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own companies"
  ON companies FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own companies"
  ON companies FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own companies"
  ON companies FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own companies"
  ON companies FOR DELETE
  USING (owner_id = auth.uid());

-- Update existing RLS policy for properties to include company relationship
-- Users can view properties they own OR properties belonging to their companies
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;

CREATE POLICY "Users can view their properties"
  ON properties FOR SELECT
  USING (
    owner_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- Comments for documentation
COMMENT ON TABLE companies IS 'Companies represent legal entities that own/manage properties and handle billing';
COMMENT ON COLUMN companies.name IS 'Legal company name (e.g., "Campgrounds Unlimited, LLC")';
COMMENT ON COLUMN companies.owner_id IS 'User who created/owns this company';
COMMENT ON COLUMN companies.stripe_customer_id IS 'Stripe customer ID for billing at company level';
COMMENT ON COLUMN companies.subscription_id IS 'Stripe subscription ID for company billing';
COMMENT ON COLUMN properties.company_id IS 'Parent company that owns this property (for portfolio management)';
