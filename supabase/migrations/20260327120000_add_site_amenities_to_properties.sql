-- Add site amenities configuration field to properties
-- Stores property-level site amenities data for setup and booking flows.

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS site_amenities JSONB;

COMMENT ON COLUMN properties.site_amenities IS
  'Property-level site amenities configuration/data used by site setup and booking experiences.';
