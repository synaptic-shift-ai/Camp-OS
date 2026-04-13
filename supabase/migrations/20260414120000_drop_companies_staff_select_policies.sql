-- Remove authenticated-only SELECT policies that let property staff read companies rows.
-- Company owners still read via "Users can view their own companies" (existing policy).
-- Drops every policy name variant used across branches / manual edits.

DROP POLICY IF EXISTS "companies_select_property_portal_roles" ON public.companies;
DROP POLICY IF EXISTS "companies_select_portal_property_roles" ON public.companies;
DROP POLICY IF EXISTS "companies_select_staff_assigned_property" ON public.companies;
