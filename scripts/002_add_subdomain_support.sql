-- Add subdomain column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS subdomain VARCHAR(63) UNIQUE;

-- Create index for subdomain lookups
CREATE INDEX IF NOT EXISTS idx_properties_subdomain ON properties(subdomain);

-- Update the slug to be used as subdomain (ensure it's URL-safe)
COMMENT ON COLUMN properties.subdomain IS 'Unique subdomain for tenant (e.g., pinevalley for pinevalley.camp-os.com)';
