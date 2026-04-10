-- Migration: property_staff.role_category_id → uuid[]
-- Description:
--   Replaces single-UUID FK with a PostgreSQL uuid[] so multiple property_role_categories
--   ids can be stored per staff row. Drops the FK (arrays cannot reference one row each).
--   Existing non-null values become one-element arrays; NULL stays NULL.
-- Application follow-up:
--   Update inserts/selects (e.g. StaffManagementQueries, generated types, invite flow).
-- NOTE: Idempotent — skips if column is already uuid[].

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'property_staff'
      AND c.column_name = 'role_category_id'
      AND c.data_type = 'uuid'
  ) THEN
    ALTER TABLE public.property_staff
      DROP CONSTRAINT IF EXISTS property_staff_role_category_id_fkey;

    ALTER TABLE public.property_staff
      ALTER COLUMN role_category_id TYPE uuid[] USING (
        CASE
          WHEN role_category_id IS NULL THEN NULL::uuid[]
          ELSE ARRAY[role_category_id]
        END
      );
  END IF;
END $$;

COMMENT ON COLUMN public.property_staff.role_category_id IS
  'Zero or more property_role_categories.id values for this staff member (same property/role semantics enforced in application).';

CREATE INDEX IF NOT EXISTS idx_property_staff_role_category_id_gin
  ON public.property_staff USING GIN (role_category_id);

COMMIT;
