-- =====================================================
-- Property Configuration System Migration
-- NOTE: Made idempotent for branch creation support
-- =====================================================
-- This migration adds comprehensive configuration options for property owners
-- to customize pricing, deposits, booking rules, and fees at both property
-- and site levels using a macro/micro override pattern.
--
-- Created: 2025-11-04
-- Feature: Admin Configuration System (CAM-XXX)
-- =====================================================

-- =====================================================
-- PART 1: Property-Level Configuration
-- =====================================================

-- Add deposit configuration to properties table
-- Allows flexible deposit rules by booking type with property-wide defaults
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS deposit_config JSONB DEFAULT '{
  "require_deposit": false,
  "deposit_type": "percentage",
  "deposit_percentage": 25,
  "deposit_amount_cents": null,
  "applies_to_booking_types": ["nightly", "weekly", "monthly", "seasonal", "long_term"],
  "exempt_if_paid_in_full": true,
  "full_payment_required_days_before": null
}'::jsonb;

COMMENT ON COLUMN properties.deposit_config IS
  'Deposit configuration settings. Structure:
  {
    "require_deposit": boolean - Enable/disable deposit requirement
    "deposit_type": "percentage" | "flat_amount" | "first_night" - Type of deposit
    "deposit_percentage": number - Percentage of total (0-100) if type is "percentage"
    "deposit_amount_cents": number - Flat amount in cents if type is "flat_amount"
    "applies_to_booking_types": string[] - Which booking types require deposit
    "exempt_if_paid_in_full": boolean - Skip deposit if guest pays full amount upfront
    "full_payment_required_days_before": number | null - Days before check-in when full payment required
  }
  Example: 25% deposit required for all booking types, waived if paid in full';

-- Add pricing configuration to properties table
-- Manages taxes, service fees, cleaning fees, and other charges
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{
  "tax_rate": 0.0,
  "tax_name": "Tax",
  "service_fee_type": "none",
  "service_fee_percentage": 0.0,
  "service_fee_amount_cents": null,
  "default_cleaning_fee_cents": null,
  "extra_guest_fee_enabled": false,
  "extra_guest_threshold": 2,
  "extra_guest_fee_cents": 0,
  "pet_fee_cents": 2000
}'::jsonb;

COMMENT ON COLUMN properties.pricing_config IS
  'Pricing and fees configuration. Structure:
  {
    "tax_rate": number - Tax percentage as decimal (e.g., 0.085 for 8.5%)
    "tax_name": string - Display name for tax (e.g., "Sales Tax", "Occupancy Tax")
    "service_fee_type": "none" | "percentage" | "flat" | "per_night" - Type of service fee
    "service_fee_percentage": number - Service fee as percentage if type is "percentage"
    "service_fee_amount_cents": number - Flat service fee in cents if type is "flat" or "per_night"
    "default_cleaning_fee_cents": number | null - Default cleaning fee (can be overridden per site)
    "extra_guest_fee_enabled": boolean - Enable extra guest fees
    "extra_guest_threshold": number - Number of guests included in base price
    "extra_guest_fee_cents": number - Fee per additional guest per night in cents
    "pet_fee_cents": number - Default pet fee (can be overridden per site)
  }
  Example: 8.5% tax + $5 service fee per night + $25 cleaning fee';

-- Add booking rules configuration to properties table
-- Manages minimum stays, booking windows, check-in/out restrictions
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS booking_rules_config JSONB DEFAULT '{
  "min_stay_nights": 1,
  "max_stay_nights": null,
  "booking_window_days": 365,
  "advance_notice_days": 0,
  "allowed_checkin_days": ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
  "allowed_checkout_days": ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
  "blackout_dates": [],
  "same_day_booking_enabled": true,
  "instant_booking_enabled": true
}'::jsonb;

COMMENT ON COLUMN properties.booking_rules_config IS
  'Booking rules and restrictions. Structure:
  {
    "min_stay_nights": number - Minimum nights required for booking
    "max_stay_nights": number | null - Maximum nights allowed (null = unlimited)
    "booking_window_days": number - How many days in advance bookings are accepted
    "advance_notice_days": number - Minimum days before check-in to book (0 = same day allowed)
    "allowed_checkin_days": string[] - Days of week check-in is allowed
    "allowed_checkout_days": string[] - Days of week check-out is allowed
    "blackout_dates": string[] - Dates when no check-in allowed (YYYY-MM-DD format)
    "same_day_booking_enabled": boolean - Allow bookings for today
    "instant_booking_enabled": boolean - Allow instant booking without approval
  }
  Example: 2 night minimum, Friday/Saturday check-in only';

-- Add weekly/monthly rate discount configuration
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS rate_discounts_config JSONB DEFAULT '{
  "weekly_discount_enabled": false,
  "weekly_discount_percentage": 0,
  "weekly_minimum_nights": 7,
  "monthly_discount_enabled": false,
  "monthly_discount_percentage": 0,
  "monthly_minimum_nights": 28
}'::jsonb;

COMMENT ON COLUMN properties.rate_discounts_config IS
  'Rate discount configuration for extended stays. Structure:
  {
    "weekly_discount_enabled": boolean - Enable weekly rate discount
    "weekly_discount_percentage": number - Percentage discount for weekly stays (0-100)
    "weekly_minimum_nights": number - Minimum nights to qualify for weekly rate
    "monthly_discount_enabled": boolean - Enable monthly rate discount
    "monthly_discount_percentage": number - Percentage discount for monthly stays (0-100)
    "monthly_minimum_nights": number - Minimum nights to qualify for monthly rate
  }
  Example: 10% off for 7+ nights, 25% off for 28+ nights';

-- =====================================================
-- PART 2: Site-Level Override Columns
-- =====================================================

-- Add deposit override to sites table
-- Allows individual sites to override property deposit settings
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS deposit_override JSONB DEFAULT NULL;

COMMENT ON COLUMN sites.deposit_override IS
  'Site-specific deposit configuration override. Uses same structure as properties.deposit_config.
  If NULL, inherits from property deposit_config. If set, overrides property settings for this site.
  Example: Premium cabins require 50% deposit instead of property default 25%';

-- Add booking rules override to sites table
-- Allows individual sites to override property booking rules
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS booking_rules_override JSONB DEFAULT NULL;

COMMENT ON COLUMN sites.booking_rules_override IS
  'Site-specific booking rules override. Uses same structure as properties.booking_rules_config.
  If NULL, inherits from property booking_rules_config. If set, overrides property settings.
  Example: Cabins require 3 night minimum instead of property default 1 night';

-- Add pricing override to sites table
-- Allows individual sites to override property pricing settings
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS pricing_override JSONB DEFAULT NULL;

COMMENT ON COLUMN sites.pricing_override IS
  'Site-specific pricing configuration override. Uses same structure as properties.pricing_config.
  If NULL, inherits from property pricing_config. Partial overrides allowed (only specified fields override).
  Example: Premium sites have $50 cleaning fee instead of property default $25';

-- Add weekly/monthly rate fields to sites table
-- Allows individual sites to have custom rates for extended stays
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS weekly_rate_cents INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS monthly_rate_cents INTEGER DEFAULT NULL;

COMMENT ON COLUMN sites.weekly_rate_cents IS
  'Weekly rate in cents for stays of 7+ nights. If NULL, applies discount from property rate_discounts_config.
  If set, this flat weekly rate is used instead of calculating from nightly rate.
  Example: 5500 = $55/night weekly rate (even if regular rate is $75/night)';

COMMENT ON COLUMN sites.monthly_rate_cents IS
  'Monthly rate in cents for stays of 28+ nights. If NULL, applies discount from property rate_discounts_config.
  If set, this flat monthly rate is used instead of calculating from nightly rate.
  Example: 3500 = $35/night monthly rate (even if regular rate is $75/night)';

-- Add constraints for new columns (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_weekly_rate_positive') THEN
    ALTER TABLE sites ADD CONSTRAINT chk_weekly_rate_positive CHECK (weekly_rate_cents IS NULL OR weekly_rate_cents > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_monthly_rate_positive') THEN
    ALTER TABLE sites ADD CONSTRAINT chk_monthly_rate_positive CHECK (monthly_rate_cents IS NULL OR monthly_rate_cents > 0);
  END IF;
END $$;

-- =====================================================
-- PART 3: Seasonal Pricing Templates Table
-- =====================================================

-- Create seasonal pricing templates table
-- Allows property owners to create reusable seasonal pricing templates
-- and apply them to multiple sites at once
CREATE TABLE IF NOT EXISTS seasonal_pricing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Template Details
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Date Range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Pricing
  price_cents INTEGER NOT NULL,
  applies_to_weekends BOOLEAN DEFAULT false,

  -- Recurrence (for annual templates like "Summer Season")
  recurring_annually BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT chk_template_price_positive CHECK (price_cents > 0),
  CONSTRAINT chk_template_date_range CHECK (end_date >= start_date),
  CONSTRAINT unique_template_name UNIQUE(property_id, name)
);

COMMENT ON TABLE seasonal_pricing_templates IS
  'Reusable seasonal pricing templates that can be applied to multiple sites.
  Property owners create templates (e.g., "Summer Peak Season", "Winter Discount")
  and bulk apply them to sites, reducing manual configuration.';

COMMENT ON COLUMN seasonal_pricing_templates.applies_to_weekends IS
  'If true, this seasonal price only applies to Friday/Saturday nights.
  If false, applies to all nights in the date range.';

COMMENT ON COLUMN seasonal_pricing_templates.recurring_annually IS
  'If true, template automatically applies every year (e.g., Summer 2025, Summer 2026).
  System uses month/day from start_date and end_date and applies to current/future years.';

-- Create index for efficient template lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_seasonal_templates_property ON seasonal_pricing_templates(property_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_templates_dates ON seasonal_pricing_templates(property_id, start_date, end_date);

-- Create template application tracking table
-- Tracks which sites have which templates applied
CREATE TABLE IF NOT EXISTS site_seasonal_template_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES seasonal_pricing_templates(id) ON DELETE CASCADE,

  -- Override settings (if site needs to deviate from template)
  price_override_cents INTEGER DEFAULT NULL,

  -- Metadata
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT unique_site_template UNIQUE(site_id, template_id),
  CONSTRAINT chk_price_override_positive CHECK (price_override_cents IS NULL OR price_override_cents > 0)
);

COMMENT ON TABLE site_seasonal_template_applications IS
  'Tracks which seasonal pricing templates are applied to which sites.
  Allows bulk template application while supporting per-site price overrides.
  Site can have multiple templates (e.g., Summer Peak + Holiday Premium).';

-- Create indexes for efficient lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_template_applications_site ON site_seasonal_template_applications(site_id);
CREATE INDEX IF NOT EXISTS idx_template_applications_template ON site_seasonal_template_applications(template_id);

-- =====================================================
-- PART 4: Update Existing Data with Sensible Defaults
-- =====================================================

-- Update existing properties with default configurations
-- This ensures existing properties work immediately without configuration

UPDATE properties
SET
  deposit_config = jsonb_set(
    COALESCE(deposit_config, '{}'::jsonb),
    '{require_deposit}',
    'false'::jsonb
  ),
  pricing_config = jsonb_set(
    jsonb_set(
      COALESCE(pricing_config, '{}'::jsonb),
      '{tax_rate}',
      '0.0'::jsonb
    ),
    '{pet_fee_cents}',
    '2000'::jsonb  -- Default $20 pet fee
  ),
  booking_rules_config = jsonb_set(
    jsonb_set(
      COALESCE(booking_rules_config, '{}'::jsonb),
      '{min_stay_nights}',
      (COALESCE(minimum_stay_nights, 1))::text::jsonb
    ),
    '{instant_booking_enabled}',
    'true'::jsonb
  )
WHERE
  deposit_config IS NULL
  OR pricing_config IS NULL
  OR booking_rules_config IS NULL;

-- =====================================================
-- PART 5: Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE seasonal_pricing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_seasonal_template_applications ENABLE ROW LEVEL SECURITY;

-- Seasonal Pricing Templates Policies (idempotent)
DROP POLICY IF EXISTS "Users can view their property templates" ON seasonal_pricing_templates;
CREATE POLICY "Users can view their property templates"
  ON seasonal_pricing_templates FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id = auth.uid()
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create templates for their properties" ON seasonal_pricing_templates;
CREATE POLICY "Users can create templates for their properties"
  ON seasonal_pricing_templates FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their property templates" ON seasonal_pricing_templates;
CREATE POLICY "Users can update their property templates"
  ON seasonal_pricing_templates FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their property templates" ON seasonal_pricing_templates;
CREATE POLICY "Users can delete their property templates"
  ON seasonal_pricing_templates FOR DELETE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );

-- Site Template Applications Policies (idempotent)
DROP POLICY IF EXISTS "Users can view their site template applications" ON site_seasonal_template_applications;
CREATE POLICY "Users can view their site template applications"
  ON site_seasonal_template_applications FOR SELECT
  USING (
    site_id IN (
      SELECT s.id FROM sites s
      INNER JOIN properties p ON s.property_id = p.id
      WHERE p.owner_id = auth.uid()
        OR p.id IN (SELECT property_id FROM property_staff WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create template applications for their sites" ON site_seasonal_template_applications;
CREATE POLICY "Users can create template applications for their sites"
  ON site_seasonal_template_applications FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT s.id FROM sites s
      INNER JOIN properties p ON s.property_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their site template applications" ON site_seasonal_template_applications;
CREATE POLICY "Users can update their site template applications"
  ON site_seasonal_template_applications FOR UPDATE
  USING (
    site_id IN (
      SELECT s.id FROM sites s
      INNER JOIN properties p ON s.property_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their site template applications" ON site_seasonal_template_applications;
CREATE POLICY "Users can delete their site template applications"
  ON site_seasonal_template_applications FOR DELETE
  USING (
    site_id IN (
      SELECT s.id FROM sites s
      INNER JOIN properties p ON s.property_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

-- =====================================================
-- PART 6: Helpful Functions
-- =====================================================

-- Function to get effective deposit config for a site (property default + site override)
CREATE OR REPLACE FUNCTION get_effective_deposit_config(site_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  property_config JSONB;
  site_config JSONB;
  effective_config JSONB;
BEGIN
  -- Get property's deposit config
  SELECT p.deposit_config INTO property_config
  FROM sites s
  INNER JOIN properties p ON s.property_id = p.id
  WHERE s.id = site_id_param;

  -- Get site's deposit override
  SELECT s.deposit_override INTO site_config
  FROM sites s
  WHERE s.id = site_id_param;

  -- If site has override, use it; otherwise use property config
  IF site_config IS NOT NULL THEN
    effective_config := site_config;
  ELSE
    effective_config := property_config;
  END IF;

  RETURN effective_config;
END;
$$;

COMMENT ON FUNCTION get_effective_deposit_config IS
  'Returns the effective deposit configuration for a site.
  If site has deposit_override set, returns that. Otherwise returns property deposit_config.
  Usage: SELECT get_effective_deposit_config(''site-uuid-here'');';

-- Function to get effective booking rules for a site
CREATE OR REPLACE FUNCTION get_effective_booking_rules(site_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  property_rules JSONB;
  site_rules JSONB;
  effective_rules JSONB;
BEGIN
  -- Get property's booking rules
  SELECT p.booking_rules_config INTO property_rules
  FROM sites s
  INNER JOIN properties p ON s.property_id = p.id
  WHERE s.id = site_id_param;

  -- Get site's booking rules override
  SELECT s.booking_rules_override INTO site_rules
  FROM sites s
  WHERE s.id = site_id_param;

  -- If site has override, merge with property rules (site overrides take precedence)
  IF site_rules IS NOT NULL THEN
    effective_rules := property_rules || site_rules;  -- JSONB || operator merges, with right side taking precedence
  ELSE
    effective_rules := property_rules;
  END IF;

  RETURN effective_rules;
END;
$$;

COMMENT ON FUNCTION get_effective_booking_rules IS
  'Returns the effective booking rules for a site.
  Merges property booking_rules_config with site booking_rules_override (site takes precedence).
  Usage: SELECT get_effective_booking_rules(''site-uuid-here'');';

-- =====================================================
-- Migration Complete
-- =====================================================
