-- Fix Site Status for Availability Search
-- Property ID: 12da6cb6-ac60-41df-ad6f-640fe3c9091a

-- First, check current status
SELECT
  site_number,
  site_name,
  status,
  base_price
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a';

-- Fix: Change 'active' to 'available' for all sites
UPDATE sites
SET status = 'available'
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND status = 'active';

-- Verify the change
SELECT
  site_number,
  site_name,
  status,
  'FIXED!' as result
FROM sites
WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
  AND status = 'available';
