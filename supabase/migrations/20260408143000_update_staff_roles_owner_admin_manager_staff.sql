-- Migration: update staff roles to owner/admin/property_admin/manager/staff
-- Description:
-- - Removes 'viewer' role from staff-related tables
-- - Adds 'admin' and 'property_admin' roles
-- - Enforces role constraints for property_staff and property_role_categories
-- NOTE: idempotent (safe to re-run)

BEGIN;

-- ============================================================================
-- Data cleanup (remove 'viewer' before tightening constraints)
-- ============================================================================

-- property_staff.role was historically unconstrained; normalize legacy values.
UPDATE public.property_staff
SET role = 'staff'
WHERE role IS NULL OR lower(role) = 'viewer';

-- property_role_categories.role had a CHECK including 'viewer'; normalize legacy values.
UPDATE public.property_role_categories
SET role = 'staff'
WHERE lower(role) = 'viewer';

-- ============================================================================
-- Enforce role constraints
-- ============================================================================

-- property_staff: require non-null + constrained set
ALTER TABLE public.property_staff
  ALTER COLUMN role SET DEFAULT 'staff',
  ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_staff_role_check'
  ) THEN
    ALTER TABLE public.property_staff
      DROP CONSTRAINT property_staff_role_check;
  END IF;
END $$;

ALTER TABLE public.property_staff
  ADD CONSTRAINT property_staff_role_check
  CHECK (role IN ('owner', 'admin', 'property_admin', 'manager', 'staff'));

-- property_role_categories: replace role CHECK with new allowed set
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_role_categories_role_check'
  ) THEN
    ALTER TABLE public.property_role_categories
      DROP CONSTRAINT property_role_categories_role_check;
  END IF;
END $$;

ALTER TABLE public.property_role_categories
  ADD CONSTRAINT property_role_categories_role_check
  CHECK (role IN ('owner', 'admin', 'property_admin', 'manager', 'staff'));

COMMIT;

