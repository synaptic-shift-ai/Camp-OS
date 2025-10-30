-- Debug Availability Search Issues
-- Property ID: 12da6cb6-ac60-41df-ad6f-640fe3c9091a

-- 1. Check property exists and is ready for bookings
SELECT
  id,
  name,
  booking_page_slug,
  onboarding_completed,
  check_in_time,
  check_out_time
FROM properties
WHERE id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- 2. Check sites for this property
SELECT
  id,
  site_number,
  site_name,
  site_type,
  status,
  base_price,
  max_occupancy,
  allow_pets
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
ORDER BY site_number;

-- 3. Check if there are any existing reservations blocking availability
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

-- 4. Verify RLS policies are working (should show sites for public access)
-- This query simulates what the public API sees
SET ROLE anon;
SELECT
  s.id,
  s.site_number,
  s.site_name,
  s.status
FROM sites s
WHERE s.property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';
RESET ROLE;

-- 5. Quick fix: Ensure at least one site is available
UPDATE sites
SET status = 'available'
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND status = 'active'  -- Change 'active' to 'available' if needed
RETURNING site_number, status;
