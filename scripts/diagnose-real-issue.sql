-- Diagnose Real Availability Search Issue
-- Property ID: 12da6cb6-ac60-41df-ad6f-640fe3c9091a

-- 1. Verify property configuration
SELECT
  id,
  name,
  booking_page_slug,
  onboarding_completed,
  check_in_time,
  check_out_time
FROM properties
WHERE id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- 2. Check if sites exist and are configured properly
SELECT
  id,
  site_number,
  site_name,
  site_type,
  status,
  base_price,
  max_occupancy,
  property_id
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- 3. TEST RLS POLICIES - This simulates what the public API sees
-- This is likely the issue!
SET ROLE anon;

SELECT
  id,
  site_number,
  site_name,
  site_type,
  status,
  base_price
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND status = 'available';

RESET ROLE;

-- 4. Check if RLS policies exist for public site access
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'sites';

-- 5. Check for any blocking reservations
SELECT
  id,
  site_id,
  check_in_date,
  check_out_date,
  status,
  confirmation_number
FROM reservations
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND status NOT IN ('cancelled', 'no_show')
ORDER BY check_in_date;
