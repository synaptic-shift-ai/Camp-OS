-- Property Wizard Enhancements
-- NOTE: Made idempotent for branch creation support
-- Adds wizard progress tracking, property images, and additional configuration fields

-- Add wizard tracking columns
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS wizard_step_completed VARCHAR(50) DEFAULT 'not_started' CHECK (
  wizard_step_completed IN ('not_started', 'property_details', 'sites_setup', 'dashboard_tour', 'stripe_connect', 'complete')
),
ADD COLUMN IF NOT EXISTS wizard_progress JSONB DEFAULT '{}'::jsonb;

-- Add property image fields
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb;

-- Add property policy and instruction fields
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS check_in_instructions TEXT,
ADD COLUMN IF NOT EXISTS check_out_instructions TEXT,
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
ADD COLUMN IF NOT EXISTS house_rules TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_wizard_step ON properties(wizard_step_completed)
  WHERE wizard_step_completed != 'complete';

-- Add comments for documentation
COMMENT ON COLUMN properties.wizard_step_completed IS 'Current wizard step: not_started | property_details | sites_setup | dashboard_tour | stripe_connect | complete';
COMMENT ON COLUMN properties.wizard_progress IS 'Wizard progress tracking: {"property_details": true, "sites_setup": false, ...}';
COMMENT ON COLUMN properties.hero_image_url IS 'Main hero image URL for property (displayed on booking page)';
COMMENT ON COLUMN properties.gallery_images IS 'Array of gallery image objects: [{ url: "...", caption: "...", order: 1 }]';
COMMENT ON COLUMN properties.check_in_instructions IS 'Instructions for guests during check-in';
COMMENT ON COLUMN properties.check_out_instructions IS 'Instructions for guests during check-out';
COMMENT ON COLUMN properties.cancellation_policy IS 'Property cancellation policy text';
COMMENT ON COLUMN properties.house_rules IS 'Property house rules and regulations';
