-- =====================================================
-- Site Type Configuration for Properties
-- NOTE: Made idempotent for branch creation support
-- =====================================================
-- This migration adds a JSONB configuration column on the properties table
-- to control which site types are offered by a given property. The UI can
-- use this configuration to constrain the "site_type" options when creating
-- or editing sites for that property.
--
-- Created: 2026-03-13
-- Feature: Property Site Type Configuration
-- =====================================================

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS site_type_config JSONB DEFAULT '{
  "allowed_site_types": []
}'::jsonb;

COMMENT ON COLUMN properties.site_type_config IS
  'Configuration for which site types a property offers. Structure:
  {
    "allowed_site_types": string[] - List of site_type values allowed for this property.
      Empty array or NULL = all site types allowed.
  }
  Example: ["RV", "TENT"]';

