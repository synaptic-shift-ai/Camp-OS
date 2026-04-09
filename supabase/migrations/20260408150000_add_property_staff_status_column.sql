-- Migration: add property_staff.status column
-- Description:
-- - Adds a new "status" column to public.property_staff
-- - Adds role_category_id to link staff to a property_role_categories row
-- NOTE: idempotent (safe to re-run)

BEGIN;

ALTER TABLE public.property_staff
  ADD COLUMN IF NOT EXISTS role_category_id uuid;

ALTER TABLE public.property_staff
  ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'active'::character varying;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_staff_role_category_id_fkey'
  ) THEN
    ALTER TABLE public.property_staff
      ADD CONSTRAINT property_staff_role_category_id_fkey
      FOREIGN KEY (role_category_id)
      REFERENCES public.property_role_categories (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Best-effort backfill: if there's exactly one category per (property_id, role), use it.
UPDATE public.property_staff ps
SET role_category_id = prc.id
FROM public.property_role_categories prc
WHERE ps.role_category_id IS NULL
  AND ps.property_id = prc.property_id
  AND ps.role = prc.role
  AND (
    SELECT count(*)
    FROM public.property_role_categories prc2
    WHERE prc2.property_id = ps.property_id
      AND prc2.role = ps.role
  ) = 1;

-- Ensure existing rows are populated before enforcing NOT NULL
UPDATE public.property_staff
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.property_staff
  ALTER COLUMN status SET DEFAULT 'active'::character varying,
  ALTER COLUMN status SET NOT NULL;

COMMIT;

