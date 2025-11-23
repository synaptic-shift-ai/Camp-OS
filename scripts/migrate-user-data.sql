-- ============================================================================
-- USER DATA MIGRATION SCRIPT
-- ============================================================================
-- This script helps you migrate your user account and related data from the
-- original Camp-OS database to the refactor database branch.
--
-- PREREQUISITES:
-- 1. You must create a user account in the refactor branch with the SAME EMAIL
--    as your original account (Supabase Auth will generate a new user_id)
-- 2. Run this script in the REFACTOR database after creating the account
-- 3. Update the variables below with your actual IDs
--
-- USAGE:
-- Step 1: Log into the refactor app and sign up with your original email
-- Step 2: Get your new user_id from the refactor database:
--         SELECT id, email FROM auth.users;
-- Step 3: Replace the variables below
-- Step 4: Run this script in the refactor database SQL editor
-- ============================================================================

-- ============================================================================
-- STEP 1: SET YOUR USER IDS
-- ============================================================================
-- Replace these with your actual user IDs:
-- - OLD_USER_ID: Your user_id from the ORIGINAL database
-- - NEW_USER_ID: Your user_id from the REFACTOR database (created when you signed up)

DO $$
DECLARE
  -- TODO: Replace with your ORIGINAL database user_id
  OLD_USER_ID UUID := 'YOUR_ORIGINAL_USER_ID_HERE';

  -- TODO: Replace with your REFACTOR database user_id (from new signup)
  NEW_USER_ID UUID := 'YOUR_REFACTOR_USER_ID_HERE';

  -- Storage for mapping old IDs to new IDs
  company_id_map JSONB := '{}';
  property_id_map JSONB := '{}';
  site_id_map JSONB := '{}';
  guest_id_map JSONB := '{}';

BEGIN
  RAISE NOTICE 'Starting migration for user % -> %', OLD_USER_ID, NEW_USER_ID;

  -- Verify the new user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW_USER_ID) THEN
    RAISE EXCEPTION 'New user ID % not found. Please sign up first!', NEW_USER_ID;
  END IF;

  RAISE NOTICE 'User verified. Ready to migrate data.';
  RAISE NOTICE 'NOTE: You must manually export data from original DB and import here';
  RAISE NOTICE 'Use the export/import scripts provided separately.';

END $$;

-- ============================================================================
-- STEP 2: EXPORT DATA FROM ORIGINAL DATABASE
-- ============================================================================
-- Run this query in your ORIGINAL database to export your data:
/*

-- Get your user_id first
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Export companies
SELECT * FROM companies WHERE owner_id = 'YOUR_ORIGINAL_USER_ID';

-- Export properties
SELECT * FROM properties
WHERE owner_id = 'YOUR_ORIGINAL_USER_ID'
   OR company_id IN (SELECT id FROM companies WHERE owner_id = 'YOUR_ORIGINAL_USER_ID');

-- Export sites
SELECT s.* FROM sites s
JOIN properties p ON s.property_id = p.id
WHERE p.owner_id = 'YOUR_ORIGINAL_USER_ID'
   OR p.company_id IN (SELECT id FROM companies WHERE owner_id = 'YOUR_ORIGINAL_USER_ID');

-- Export guests
SELECT g.* FROM guests g
JOIN properties p ON g.property_id = p.id
WHERE p.owner_id = 'YOUR_ORIGINAL_USER_ID'
   OR p.company_id IN (SELECT id FROM companies WHERE owner_id = 'YOUR_ORIGINAL_USER_ID');

-- Export reservations
SELECT r.* FROM reservations r
JOIN properties p ON r.property_id = p.id
WHERE p.owner_id = 'YOUR_ORIGINAL_USER_ID'
   OR p.company_id IN (SELECT id FROM companies WHERE owner_id = 'YOUR_ORIGINAL_USER_ID');

-- Export payments
SELECT pay.* FROM payments pay
JOIN properties p ON pay.property_id = p.id
WHERE p.owner_id = 'YOUR_ORIGINAL_USER_ID'
   OR p.company_id IN (SELECT id FROM companies WHERE owner_id = 'YOUR_ORIGINAL_USER_ID');

*/

-- ============================================================================
-- STEP 3: IMPORT DATA INTO REFACTOR DATABASE
-- ============================================================================
-- After exporting, you'll need to create INSERT statements with the exported data.
-- This is a template - you'll need to fill in your actual data.

-- EXAMPLE: Insert a company (replace with your actual data)
/*
INSERT INTO companies (
  id, name, owner_id, stripe_customer_id, subscription_status,
  subscription_plan, billing_cycle, created_at, updated_at
) VALUES (
  'OLD_COMPANY_ID_HERE',
  'Your Company Name',
  'YOUR_REFACTOR_USER_ID',  -- Use NEW user_id
  'cus_stripe_id',
  'active',
  'pro',
  'monthly',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  owner_id = EXCLUDED.owner_id,
  updated_at = NOW();
*/

-- EXAMPLE: Insert properties (replace with your actual data)
/*
INSERT INTO properties (
  id, company_id, name, slug, owner_id, email, phone,
  address, city, state, zip_code, property_type,
  description, check_in_time, check_out_time,
  timezone, status, created_at, updated_at
) VALUES (
  'OLD_PROPERTY_ID_HERE',
  'OLD_COMPANY_ID_HERE',  -- Same company ID from above
  'Your Campground Name',
  'your-campground',
  'YOUR_REFACTOR_USER_ID',  -- Use NEW user_id
  'contact@example.com',
  '555-1234',
  '123 Camp Road',
  'Asheville',
  'NC',
  '28801',
  'campground',
  'Beautiful campground',
  '15:00:00',
  '11:00:00',
  'America/New_York',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  owner_id = EXCLUDED.owner_id,
  updated_at = NOW();
*/

-- Continue with sites, guests, reservations, payments following the same pattern

-- ============================================================================
-- HELPFUL QUERIES
-- ============================================================================

-- Check what data exists in refactor database
-- SELECT 'companies' as table_name, COUNT(*) FROM companies
-- UNION ALL
-- SELECT 'properties', COUNT(*) FROM properties
-- UNION ALL
-- SELECT 'sites', COUNT(*) FROM sites
-- UNION ALL
-- SELECT 'guests', COUNT(*) FROM guests
-- UNION ALL
-- SELECT 'reservations', COUNT(*) FROM reservations
-- UNION ALL
-- SELECT 'payments', COUNT(*) FROM payments;

-- View your companies
-- SELECT id, name, owner_id, subscription_status, subscription_plan
-- FROM companies
-- WHERE owner_id = 'YOUR_REFACTOR_USER_ID';

-- View your properties
-- SELECT id, name, slug, company_id, status
-- FROM properties
-- WHERE owner_id = 'YOUR_REFACTOR_USER_ID'
--    OR company_id IN (SELECT id FROM companies WHERE owner_id = 'YOUR_REFACTOR_USER_ID');
