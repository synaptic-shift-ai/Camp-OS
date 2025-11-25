-- Booking Page Configuration
-- NOTE: Made idempotent for branch creation support
-- Adds booking page customization fields for property-specific booking portals

-- Add booking page operational fields
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS check_in_time TIME DEFAULT '15:00:00',
ADD COLUMN IF NOT EXISTS check_out_time TIME DEFAULT '11:00:00',
ADD COLUMN IF NOT EXISTS booking_page_description TEXT,
ADD COLUMN IF NOT EXISTS booking_page_tagline TEXT,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS office_hours TEXT,
ADD COLUMN IF NOT EXISTS minimum_stay_nights INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS special_instructions TEXT,
ADD COLUMN IF NOT EXISTS directions TEXT;

-- Add white-labeling fields (for future v1.1)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_color_primary VARCHAR(7),
ADD COLUMN IF NOT EXISTS brand_color_secondary VARCHAR(7),
ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Create index for custom domains (for future domain routing)
CREATE INDEX IF NOT EXISTS idx_properties_custom_domain ON properties(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN properties.check_in_time IS 'Default check-in time (24-hour format, e.g., 15:00:00 for 3 PM)';
COMMENT ON COLUMN properties.check_out_time IS 'Default check-out time (24-hour format, e.g., 11:00:00 for 11 AM)';
COMMENT ON COLUMN properties.booking_page_description IS 'Main description shown on the booking page (2-3 sentences)';
COMMENT ON COLUMN properties.booking_page_tagline IS 'Short tagline/slogan for the property (optional, 1 sentence)';
COMMENT ON COLUMN properties.timezone IS 'IANA timezone identifier (e.g., America/New_York, America/Los_Angeles)';
COMMENT ON COLUMN properties.office_hours IS 'Property office hours (e.g., "9 AM - 5 PM daily")';
COMMENT ON COLUMN properties.minimum_stay_nights IS 'Minimum number of nights required for booking';
COMMENT ON COLUMN properties.special_instructions IS 'Additional instructions for guests (arrival procedures, parking, etc.)';
COMMENT ON COLUMN properties.directions IS 'Directions to the property (GPS coordinates, turn-by-turn, etc.)';
COMMENT ON COLUMN properties.logo_url IS 'Property logo URL (for white-labeling)';
COMMENT ON COLUMN properties.brand_color_primary IS 'Primary brand color (hex format, e.g., #3B82F6)';
COMMENT ON COLUMN properties.brand_color_secondary IS 'Secondary brand color (hex format)';
COMMENT ON COLUMN properties.custom_domain IS 'Custom domain for booking page (e.g., book.pinecampground.com)';
