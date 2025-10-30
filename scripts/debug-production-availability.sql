-- Debug Production Availability Search
-- Run these queries in your PRODUCTION Supabase SQL Editor

-- 1. Verify property configuration
SELECT
  id,
  name,
  booking_page_slug,
  onboarding_completed,
  status,
  'Property Check' as test
FROM properties
WHERE id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- 2. Verify sites exist and have correct status
SELECT
  id,
  property_id,
  site_number,
  site_name,
  site_type,
  status,
  base_price,
  max_occupancy,
  'Site Check' as test
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- 3. Check if there are any blocking reservations
SELECT
  r.id,
  r.site_id,
  r.check_in_date,
  r.check_out_date,
  r.status,
  s.site_number,
  'Reservation Check' as test
FROM reservations r
JOIN sites s ON s.id = r.site_id
WHERE r.property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND r.status IN ('pending', 'confirmed', 'checked_in')
ORDER BY r.check_in_date;

-- 4. Test the exact query the API would run (for tomorrow to 2 days from now)
SELECT
  id,
  site_number,
  site_name,
  site_type,
  base_price,
  'Simulated API Query' as test
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND status = 'available';

-- 5. Check if service role can access sites (simulates API behavior)
-- This should return sites if everything is working
SELECT
  COUNT(*) as total_available_sites
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND status = 'available';
