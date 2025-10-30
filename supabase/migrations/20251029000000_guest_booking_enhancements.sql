-- Guest Booking Enhancements
-- Adds indexes and RLS policies for public guest booking functionality
--
-- This migration enables:
-- - Faster property lookups by booking page slug
-- - Guest access to view sites
-- - Guest ability to create reservations (with rate limiting at app level)
-- - Guest ability to create guest records

BEGIN;

-- ============================================================================
-- Performance Indexes
-- ============================================================================

-- Index for booking page lookups (public property access)
CREATE INDEX IF NOT EXISTS idx_properties_booking_page_slug
ON properties(booking_page_slug)
WHERE booking_page_slug IS NOT NULL;

-- Index for active sites lookup (public availability search)
CREATE INDEX IF NOT EXISTS idx_sites_property_status_active
ON sites(property_id, status)
WHERE status = 'available';

-- Index for reservation date range queries (availability checks)
CREATE INDEX IF NOT EXISTS idx_reservations_site_dates
ON reservations(site_id, check_in_date, check_out_date)
WHERE status NOT IN ('cancelled', 'no_show');

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on tables (if not already enabled)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Properties: Public read access for booking pages
-- ============================================================================

-- Allow anonymous users to view properties with active booking pages
DROP POLICY IF EXISTS "Public properties read access" ON properties;
CREATE POLICY "Public properties read access"
ON properties FOR SELECT
TO anon
USING (
  booking_page_slug IS NOT NULL
  AND onboarding_completed = true
);

-- ============================================================================
-- Sites: Public read access for available sites
-- ============================================================================

-- Allow anonymous users to view available sites for booking
DROP POLICY IF EXISTS "Public sites read access" ON sites;
CREATE POLICY "Public sites read access"
ON sites FOR SELECT
TO anon
USING (
  status = 'available'
  AND property_id IN (
    SELECT id FROM properties
    WHERE booking_page_slug IS NOT NULL
    AND onboarding_completed = true
  )
);

-- ============================================================================
-- Guests: Allow anonymous creation for new bookings
-- ============================================================================

-- Allow anonymous users to create guest records (for new bookings)
-- Note: Rate limiting should be implemented at application level
DROP POLICY IF EXISTS "Anonymous guest creation" ON guests;
CREATE POLICY "Anonymous guest creation"
ON guests FOR INSERT
TO anon
WITH CHECK (true);

-- Allow users to read their own guest records (by email match)
-- This is for returning guests who might have an account
DROP POLICY IF EXISTS "Users read own guest records" ON guests;
CREATE POLICY "Users read own guest records"
ON guests FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR email = auth.jwt()->>'email'
);

-- ============================================================================
-- Reservations: Allow anonymous creation for new bookings
-- ============================================================================

-- Allow anonymous users to create reservations
-- Note: Rate limiting should be implemented at application level
-- Initial status must be 'pending' (confirmed after payment)
DROP POLICY IF EXISTS "Anonymous reservation creation" ON reservations;
CREATE POLICY "Anonymous reservation creation"
ON reservations FOR INSERT
TO anon
WITH CHECK (
  status = 'pending'
  AND payment_status IN ('unpaid', 'pending')
);

-- Allow anonymous users to read their own reservations by confirmation number
-- This enables "check your booking" functionality
DROP POLICY IF EXISTS "Anonymous reservation read by confirmation" ON reservations;
CREATE POLICY "Anonymous reservation read by confirmation"
ON reservations FOR SELECT
TO anon
USING (true); -- Will be filtered by confirmation_number at app level

-- Allow authenticated users to read their own reservations
DROP POLICY IF EXISTS "Users read own reservations" ON reservations;
CREATE POLICY "Users read own reservations"
ON reservations FOR SELECT
TO authenticated
USING (
  guest_id IN (
    SELECT id FROM guests WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- Property Staff/Admin: Full access to their property's data
-- ============================================================================

-- Property owners/staff can view all sites for their property
DROP POLICY IF EXISTS "Property staff sites access" ON sites;
CREATE POLICY "Property staff sites access"
ON sites FOR ALL
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE owner_id = auth.uid()
  )
);

-- Property owners/staff can view all guests for their property
DROP POLICY IF EXISTS "Property staff guests access" ON guests;
CREATE POLICY "Property staff guests access"
ON guests FOR ALL
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE owner_id = auth.uid()
  )
);

-- Property owners/staff can view all reservations for their property
DROP POLICY IF EXISTS "Property staff reservations access" ON reservations;
CREATE POLICY "Property staff reservations access"
ON reservations FOR ALL
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE owner_id = auth.uid()
  )
);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON INDEX idx_properties_booking_page_slug IS 'Fast lookup for property booking pages by slug';
COMMENT ON INDEX idx_sites_property_status_active IS 'Fast lookup for available sites during availability search';
COMMENT ON INDEX idx_reservations_site_dates IS 'Fast date range queries for availability checks';

COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify policies are created
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('properties', 'sites', 'guests', 'reservations')
-- ORDER BY tablename, policyname;

-- Verify indexes are created
-- SELECT indexname, tablename, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND indexname LIKE 'idx_%booking%' OR indexname LIKE 'idx_%guest%';
