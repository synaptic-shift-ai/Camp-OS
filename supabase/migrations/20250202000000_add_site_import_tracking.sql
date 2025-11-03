-- Migration: Add Site Import Tracking and Unique Constraint
--
-- Purpose: Support CSV bulk upload feature for sites
-- - Adds UNIQUE constraint on (property_id, site_number) to prevent duplicates
-- - Adds import tracking columns (imported_at, imported_by)
-- - Adds index for performance on unique constraint lookup
--
-- After applying:
-- - Run: npm run gen:db to regenerate TypeScript types
-- - Update Site type in lib/booking/types.ts with new fields

BEGIN;

-- ============================================================================
-- Step 1: Add UNIQUE constraint on (property_id, site_number)
-- ============================================================================
-- This prevents duplicate site numbers within a single property
-- Existing data must not have duplicates for this to succeed

DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_property_site_number'
  ) THEN
    ALTER TABLE sites
      ADD CONSTRAINT unique_property_site_number
      UNIQUE (property_id, site_number);
  END IF;
END $$;

-- ============================================================================
-- Step 2: Add import tracking columns
-- ============================================================================
-- These columns track when and by whom sites were bulk imported via CSV

-- Add imported_at timestamp (nullable - only set for CSV imports)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'imported_at'
  ) THEN
    ALTER TABLE sites ADD COLUMN imported_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Add imported_by user reference (nullable - only set for CSV imports)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'imported_by'
  ) THEN
    ALTER TABLE sites ADD COLUMN imported_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- Step 3: Add performance index
-- ============================================================================
-- Index on (property_id, site_number) for fast duplicate checks during import

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_sites_property_site_number'
  ) THEN
    CREATE INDEX idx_sites_property_site_number
      ON sites(property_id, site_number);
  END IF;
END $$;

-- ============================================================================
-- Step 4: Add comment documentation
-- ============================================================================

COMMENT ON COLUMN sites.imported_at IS
  'Timestamp when this site was imported via CSV bulk upload. NULL for manually created sites.';

COMMENT ON COLUMN sites.imported_by IS
  'User ID who performed the CSV bulk import. NULL for manually created sites.';

COMMIT;

-- ============================================================================
-- Post-migration checklist:
-- ============================================================================
-- 1. Run: npm run gen:db
-- 2. Update Site type in lib/booking/types.ts:
--    - Add imported_at?: string | null
--    - Add imported_by?: string | null
-- 3. Test CSV import feature with duplicate site_number (should be rejected)
-- 4. Verify existing sites remain unaffected (imported_at/imported_by are NULL)
