-- Replace broad "assigned to property" SELECT with explicit property_role_categories linkage.
-- Staff may read a company row only if they are on property_staff for a property under that
-- company AND their role_category_id[] references at least one property_role_categories row
-- for that same property.
--
-- If your remote database applied different SQL, replace this file with the exact statements from:
--   select statements from supabase_migrations.schema_migrations where version = '20260413130000';
-- Alternatively, remove only the history row (DB objects unchanged) with:
--   supabase migration repair --status reverted 20260413130000

DROP POLICY IF EXISTS "companies_select_staff_assigned_property" ON public.companies;

DROP POLICY IF EXISTS "companies_select_portal_property_roles" ON public.companies;

CREATE POLICY "companies_select_portal_property_roles"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      INNER JOIN public.property_staff ps
        ON ps.property_id = p.id
        AND ps.user_id = auth.uid()
      WHERE p.company_id = companies.id
        AND ps.role_category_id IS NOT NULL
        AND cardinality(ps.role_category_id) > 0
        AND EXISTS (
          SELECT 1
          FROM public.property_role_categories prc
          WHERE prc.property_id = p.id
            AND prc.id = ANY (ps.role_category_id)
        )
    )
  );

COMMENT ON POLICY "companies_select_portal_property_roles" ON public.companies IS
  'Staff read company when assigned to a property under that company with role categories linked to property_role_categories.';
