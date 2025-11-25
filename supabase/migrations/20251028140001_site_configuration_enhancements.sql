-- Site Configuration Enhancements
-- NOTE: Made idempotent for branch creation support
-- Adds amenities, images, advanced pricing, and availability rules for comprehensive site setup

-- Add advanced pricing columns
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS weekend_price_cents INTEGER,
ADD COLUMN IF NOT EXISTS seasonal_pricing JSONB DEFAULT '[]'::jsonb;

-- Add amenities and features
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS site_amenities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS accessibility_features JSONB DEFAULT '[]'::jsonb;

-- Add site images
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS site_images JSONB DEFAULT '[]'::jsonb;

-- Add availability and booking rules
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS availability_rules JSONB DEFAULT '{}'::jsonb;

-- Add site size
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS size_sqft INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sites_property_status ON sites(property_id, status);
CREATE INDEX IF NOT EXISTS idx_sites_type ON sites(site_type);

-- Add check constraint for weekend pricing (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_weekend_price_positive') THEN
    ALTER TABLE sites ADD CONSTRAINT chk_weekend_price_positive CHECK (weekend_price_cents IS NULL OR weekend_price_cents > 0);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN sites.weekend_price_cents IS 'Weekend nightly rate in cents (Friday-Saturday)';
COMMENT ON COLUMN sites.seasonal_pricing IS 'Seasonal price overrides: [{ season: "summer", start_date: "06-01", end_date: "08-31", price_cents: 5500 }]';
COMMENT ON COLUMN sites.site_amenities IS 'Site-specific amenities: ["fire_pit", "picnic_table", "grill", "shade", "lake_view", "waterfront", "pet_friendly"]';
COMMENT ON COLUMN sites.accessibility_features IS 'Accessibility features: ["wheelchair_accessible", "paved_path", "accessible_restroom"]';
COMMENT ON COLUMN sites.site_images IS 'Site images: [{ url: "...", caption: "...", order: 1, is_primary: false }]';
COMMENT ON COLUMN sites.availability_rules IS 'Booking rules: { min_stay: 2, max_stay: 14, booking_window_days: 365, blackout_dates: ["2025-07-04", "2025-12-25"] }';
COMMENT ON COLUMN sites.size_sqft IS 'Site size in square feet';

-- Sample data structure examples (for reference)
COMMENT ON COLUMN sites.seasonal_pricing IS $comment$
Seasonal pricing example:
[
  {
    "season": "summer",
    "start_date": "2025-06-01",
    "end_date": "2025-08-31",
    "price_cents": 5500,
    "applies_to_weekends": false
  },
  {
    "season": "holiday_premium",
    "start_date": "2025-07-01",
    "end_date": "2025-07-07",
    "price_cents": 7500,
    "applies_to_weekends": true
  }
]
$comment$;

COMMENT ON COLUMN sites.availability_rules IS $comment$
Availability rules example:
{
  "min_stay": 2,
  "max_stay": 14,
  "booking_window_days": 365,
  "advance_booking_days": 1,
  "blackout_dates": ["2025-07-04", "2025-12-25"],
  "check_in_days": ["monday", "friday", "saturday"],
  "check_out_days": ["monday", "friday", "saturday"]
}
$comment$;
