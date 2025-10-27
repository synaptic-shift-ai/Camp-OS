-- Add onboarding tracking columns to properties
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS booking_page_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add hookups to sites
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS hookups JSONB DEFAULT '{"water": false, "electric": false, "sewer": false}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_slug ON properties(booking_page_slug);
CREATE INDEX IF NOT EXISTS idx_properties_onboarding ON properties(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_properties_stripe ON properties(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN properties.stripe_account_id IS 'Stripe Connect account ID for payment processing';
COMMENT ON COLUMN properties.booking_page_slug IS 'URL-friendly slug for booking page (e.g., "pine-lake-campground-a1b2c3d4")';
COMMENT ON COLUMN properties.onboarding_completed IS 'Whether operator has completed onboarding flow';
COMMENT ON COLUMN sites.hookups IS 'Available hookups as JSON: {"water": bool, "electric": bool, "sewer": bool}';
