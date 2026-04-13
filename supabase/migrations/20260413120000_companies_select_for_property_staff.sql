-- Allow authenticated property staff to read the company row when they are assigned
-- to at least one property belonging to that company (e.g. account settings / company name).
-- Owner-only policies for INSERT/UPDATE/DELETE are unchanged.

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
