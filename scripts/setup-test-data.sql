-- Setup Test Data for Guest Booking Portal
-- Run this to ensure you have proper test data for Phase 5 testing

-- ===========================================================================
-- Step 1: Verify/Update Property Configuration
-- ===========================================================================

-- Check your property (replace with your property ID)
SELECT
  id,
  name,
  booking_page_slug,
  onboarding_completed,
  check_in_time,
  check_out_time,
  email,
  phone,
  stripe_account_id
FROM properties
WHERE id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- Ensure property is ready for bookings
UPDATE properties
SET
  onboarding_completed = true,
  check_in_time = '15:00:00',  -- 3 PM
  check_out_time = '11:00:00',  -- 11 AM
  directions = 'From Highway 94, turn north on Main Street. Continue 2 miles and turn right at the campground sign.'
WHERE id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- ===========================================================================
-- Step 2: Fix Site Status (Critical!)
-- ===========================================================================

-- Update all sites to 'available' status for availability search
UPDATE sites
SET status = 'available'
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- Verify sites are now available
SELECT
  site_number,
  site_name,
  site_type,
  status,
  base_price / 100.0 as price_per_night,
  max_occupancy
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
ORDER BY site_number;

-- ===========================================================================
-- Step 3: Add Sample Sites (if needed)
-- ===========================================================================

-- Check if you have enough sites (need at least 3 for good testing)
SELECT COUNT(*) as total_sites
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- If you have fewer than 3 sites, add some test sites:
-- (Uncomment and run if needed)

/*
INSERT INTO sites (
  property_id,
  site_number,
  site_name,
  site_type,
  status,
  base_price,
  max_occupancy,
  max_vehicles,
  allow_pets,
  pet_fee,
  amenities
) VALUES
-- RV Site
('12da6cb6-ac60-41df-ad6f-640fe3c9091a', 1, 'Riverside RV Pad A-1', 'rv', 'available', 8500, 6, 2, true, 2000, ARRAY['water', 'electric', 'sewer', 'wifi']::text[]),

-- Tent Site
('12da6cb6-ac60-41df-ad6f-640fe3c9091a', 2, 'Forest Tent Site B-1', 'tent', 'available', 4500, 4, 1, true, 1500, ARRAY['picnic_table', 'fire_pit', 'water_nearby']::text[]),

-- Cabin
('12da6cb6-ac60-41df-ad6f-640fe3c9091a', 3, 'Lakeside Cabin C-1', 'cabin', 'available', 15000, 4, 2, true, 2500, ARRAY['electricity', 'heating', 'kitchen', 'bathroom', 'wifi']::text[]);
*/

-- ===========================================================================
-- Step 4: Clear Old Test Reservations (Optional)
-- ===========================================================================

-- View existing test reservations
SELECT
  id,
  confirmation_number,
  check_in_date,
  check_out_date,
  status,
  payment_status,
  total_amount / 100.0 as total_dollars
FROM reservations
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND confirmation_number LIKE 'CAMP-TEST-%'
ORDER BY created_at DESC;

-- Delete old test reservations if needed (CAREFUL!)
-- Uncomment only if you want to clear test data
/*
DELETE FROM reservations
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND confirmation_number LIKE 'CAMP-TEST-%';
*/

-- ===========================================================================
-- Step 5: Verify Configuration Summary
-- ===========================================================================

SELECT
  '✅ Property Ready' as check_type,
  COUNT(*) as count,
  'Property configured with booking page slug' as status
FROM properties
WHERE id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND booking_page_slug IS NOT NULL
  AND onboarding_completed = true

UNION ALL

SELECT
  '✅ Sites Available',
  COUNT(*),
  CONCAT(COUNT(*), ' sites ready for booking')
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND status = 'available'

UNION ALL

SELECT
  '✅ RLS Policies',
  COUNT(*),
  'Public access policies enabled'
FROM pg_policies
WHERE tablename IN ('properties', 'sites', 'guests', 'reservations')
  AND policyname LIKE '%Public%' OR policyname LIKE '%Anonymous%';

-- ===========================================================================
-- Step 6: Get Booking URL
-- ===========================================================================

SELECT
  CONCAT('http://localhost:3000/book/', booking_page_slug) as booking_url,
  'Copy this URL to test!' as action
FROM properties
WHERE id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- ===========================================================================
-- Verification Complete!
-- ===========================================================================

-- If all checks above show positive counts, you're ready to test:
-- 1. Copy the booking URL from Step 6
-- 2. Open in browser
-- 3. Search for dates (tomorrow -> 2 days from now)
-- 4. You should see available sites!
