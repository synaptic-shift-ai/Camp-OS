-- Reverts effects of migration 20260413130000 (companies_select_portal_property_roles).
-- Restores the company SELECT policy from 20260413120000_companies_select_for_property_staff.sql.
--
-- Apply with: supabase db push (or run this file in SQL Editor).
-- Note: The row for 20260413130000 remains in supabase_migrations.schema_migrations;
-- this migration only reverses the database objects. Do not delete history rows manually.

DROP POLICY IF EXISTS "companies_select_portal_property_roles" ON public.companies;

DROP POLICY IF EXISTS "companies_select_staff_assigned_property" ON public.companies;

CREATE POLICY "companies_select_staff_assigned_property"
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
    )
  );

COMMENT ON POLICY "companies_select_staff_assigned_property" ON public.companies IS
  'Staff can read company metadata for companies that own properties they are assigned to.';
