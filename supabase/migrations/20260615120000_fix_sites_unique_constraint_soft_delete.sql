-- Migration: Allow reusing site numbers after soft delete
--
-- Problem: unique_property_site_number applies to all rows, including soft-deleted
-- sites (deleted_at IS NOT NULL). The app excludes deleted rows in existsBySiteNumber,
-- so create fails at INSERT with a duplicate key error.
--
-- Fix: Replace the table constraint with a partial unique index on active sites only.

BEGIN;

-- Drop the blanket unique constraint (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_property_site_number'
      AND conrelid = 'public.sites'::regclass
  ) THEN
    ALTER TABLE public.sites
      DROP CONSTRAINT unique_property_site_number;
  END IF;
END $$;

-- Enforce uniqueness only among non-deleted sites
CREATE UNIQUE INDEX IF NOT EXISTS unique_property_site_number_active
  ON public.sites (property_id, site_number)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.unique_property_site_number_active IS
  'Ensures site_number is unique per property among active (non-deleted) sites.';

COMMIT;
