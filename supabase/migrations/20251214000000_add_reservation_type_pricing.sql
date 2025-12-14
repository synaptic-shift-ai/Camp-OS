-- =====================================================
-- Reservation Type Pricing Migration
-- NOTE: Made idempotent for branch creation support
-- =====================================================
-- This migration adds support for pricing by reservation type
-- (nightly, weekly, monthly, seasonal) at both property and site levels.
--
-- Created: 2025-12-14
-- Feature: Reservation Type Pricing
-- =====================================================

-- =====================================================
-- PART 1: Property-Level Reservation Type Configuration
-- =====================================================

-- Add enabled reservation types to properties table
-- Tracks which reservation types are available for this property
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS enabled_reservation_types JSONB DEFAULT '["nightly", "weekly", "monthly"]'::jsonb;

COMMENT ON COLUMN properties.enabled_reservation_types IS
  'Array of enabled reservation types for this property.
  Valid values: "nightly", "weekly", "monthly", "seasonal"
  Example: ["nightly", "weekly", "monthly"]';

-- Add detailed reservation type configuration
-- Contains min/max nights and enabled status for each type
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS reservation_type_config JSONB DEFAULT '{
  "nightly": {"enabled": true, "min_nights": 1, "max_nights": 6},
  "weekly": {"enabled": true, "min_nights": 7, "max_nights": 27},
  "monthly": {"enabled": true, "min_nights": 28, "max_nights": null},
  "seasonal": {"enabled": false, "flat_rate": true}
}'::jsonb;

COMMENT ON COLUMN properties.reservation_type_config IS
  'Detailed configuration for each reservation type. Structure:
  {
    "nightly": { "enabled": boolean, "min_nights": number, "max_nights": number | null },
    "weekly": { "enabled": boolean, "min_nights": number, "max_nights": number | null },
    "monthly": { "enabled": boolean, "min_nights": number, "max_nights": number | null },
    "seasonal": { "enabled": boolean, "flat_rate": true }
  }
  - min_nights: Minimum nights for this rate type to apply
  - max_nights: Maximum nights (null = unlimited)
  - flat_rate: For seasonal, indicates flat rate vs per-night pricing';

-- =====================================================
-- PART 2: Site-Level Overrides
-- =====================================================

-- Add site-level reservation type overrides
-- Allows sites to enable/disable specific types, overriding property defaults
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS enabled_reservation_types_override JSONB DEFAULT NULL;

COMMENT ON COLUMN sites.enabled_reservation_types_override IS
  'Override array of enabled reservation types for this specific site.
  If NULL, inherits from property. If set, overrides property settings.
  Example: ["nightly", "weekly"] - site only accepts nightly and weekly bookings';

-- Add seasonal rate field to sites
-- Base seasonal rate for this site (in cents)
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS seasonal_rate_cents INTEGER DEFAULT NULL;

COMMENT ON COLUMN sites.seasonal_rate_cents IS
  'Default seasonal rate for this site in cents.
  Used when site is booked for a seasonal period.
  Can be overridden per season via site_seasonal_rates table.';

-- =====================================================
-- PART 3: Seasonal Periods Table (Property-Level)
-- =====================================================

-- Create property_seasonal_periods table
-- Defines named seasonal periods with date ranges for each property
CREATE TABLE IF NOT EXISTS property_seasonal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_month INTEGER NOT NULL CHECK (start_month >= 1 AND start_month <= 12),
  start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
  end_month INTEGER NOT NULL CHECK (end_month >= 1 AND end_month <= 12),
  end_day INTEGER NOT NULL CHECK (end_day >= 1 AND end_day <= 31),
  base_rate_cents INTEGER NOT NULL CHECK (base_rate_cents >= 0),
  recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_season_name_per_property UNIQUE(property_id, name)
);

COMMENT ON TABLE property_seasonal_periods IS
  'Defines seasonal periods for properties with date ranges and flat rates.
  Seasons are defined by month/day ranges (e.g., Summer: Jun 1 - Aug 31).
  If recurring=true, the season applies every year.';

COMMENT ON COLUMN property_seasonal_periods.name IS 'Display name for the season (e.g., "Summer Season", "Winter Rates")';
COMMENT ON COLUMN property_seasonal_periods.start_month IS 'Start month (1-12)';
COMMENT ON COLUMN property_seasonal_periods.start_day IS 'Start day of month (1-31)';
COMMENT ON COLUMN property_seasonal_periods.end_month IS 'End month (1-12)';
COMMENT ON COLUMN property_seasonal_periods.end_day IS 'End day of month (1-31)';
COMMENT ON COLUMN property_seasonal_periods.base_rate_cents IS 'Flat rate for the entire season in cents (not per-night)';
COMMENT ON COLUMN property_seasonal_periods.recurring IS 'If true, season repeats annually';

-- Create index for efficient property lookups
CREATE INDEX IF NOT EXISTS idx_seasonal_periods_property_id
ON property_seasonal_periods(property_id);

-- =====================================================
-- PART 4: Site Seasonal Rates Table
-- =====================================================

-- Create site_seasonal_rates table
-- Allows per-site rate overrides for each seasonal period
CREATE TABLE IF NOT EXISTS site_seasonal_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  seasonal_period_id UUID NOT NULL REFERENCES property_seasonal_periods(id) ON DELETE CASCADE,
  rate_cents INTEGER NOT NULL CHECK (rate_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_site_seasonal_period UNIQUE(site_id, seasonal_period_id)
);

COMMENT ON TABLE site_seasonal_rates IS
  'Per-site rate overrides for seasonal periods.
  If a site has an entry here, it overrides the base_rate_cents from property_seasonal_periods.
  If no entry exists, the site uses the property-level base_rate_cents.';

COMMENT ON COLUMN site_seasonal_rates.rate_cents IS 'Site-specific flat rate for this season in cents';

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_site_seasonal_rates_site_id
ON site_seasonal_rates(site_id);

CREATE INDEX IF NOT EXISTS idx_site_seasonal_rates_period_id
ON site_seasonal_rates(seasonal_period_id);

-- =====================================================
-- PART 5: Row Level Security (RLS)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE property_seasonal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_seasonal_rates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view seasonal periods for properties they have access to
CREATE POLICY "Users can view seasonal periods for accessible properties"
ON property_seasonal_periods
FOR SELECT
USING (
  property_id IN (
    SELECT p.id FROM properties p
    JOIN companies c ON p.company_id = c.id
    WHERE c.owner_id = auth.uid()
  )
);

-- Policy: Users can manage seasonal periods for their properties
CREATE POLICY "Users can manage seasonal periods for their properties"
ON property_seasonal_periods
FOR ALL
USING (
  property_id IN (
    SELECT p.id FROM properties p
    JOIN companies c ON p.company_id = c.id
    WHERE c.owner_id = auth.uid()
  )
)
WITH CHECK (
  property_id IN (
    SELECT p.id FROM properties p
    JOIN companies c ON p.company_id = c.id
    WHERE c.owner_id = auth.uid()
  )
);

-- Policy: Users can view site seasonal rates for their sites
CREATE POLICY "Users can view site seasonal rates for accessible sites"
ON site_seasonal_rates
FOR SELECT
USING (
  site_id IN (
    SELECT s.id FROM sites s
    JOIN properties p ON s.property_id = p.id
    JOIN companies c ON p.company_id = c.id
    WHERE c.owner_id = auth.uid()
  )
);

-- Policy: Users can manage site seasonal rates for their sites
CREATE POLICY "Users can manage site seasonal rates for their sites"
ON site_seasonal_rates
FOR ALL
USING (
  site_id IN (
    SELECT s.id FROM sites s
    JOIN properties p ON s.property_id = p.id
    JOIN companies c ON p.company_id = c.id
    WHERE c.owner_id = auth.uid()
  )
)
WITH CHECK (
  site_id IN (
    SELECT s.id FROM sites s
    JOIN properties p ON s.property_id = p.id
    JOIN companies c ON p.company_id = c.id
    WHERE c.owner_id = auth.uid()
  )
);

-- Policy: Service role can access all (for API operations)
CREATE POLICY "Service role can access all seasonal periods"
ON property_seasonal_periods
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can access all site seasonal rates"
ON site_seasonal_rates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Public can view seasonal periods for public booking portal
CREATE POLICY "Public can view seasonal periods for booking"
ON property_seasonal_periods
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- PART 6: Updated At Trigger
-- =====================================================

-- Create trigger for updated_at on property_seasonal_periods
CREATE OR REPLACE FUNCTION update_seasonal_periods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_seasonal_periods_updated_at ON property_seasonal_periods;
CREATE TRIGGER trigger_update_seasonal_periods_updated_at
  BEFORE UPDATE ON property_seasonal_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_seasonal_periods_updated_at();
