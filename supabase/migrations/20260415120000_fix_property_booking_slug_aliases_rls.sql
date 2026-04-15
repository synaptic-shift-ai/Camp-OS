-- Migration: Fix RLS on property_booking_slug_aliases for non-property-owner editors
-- Description:
--   The original policy only allowed rows where properties.owner_id = auth.uid().
--   Dashboard property updates are allowed for company owners and for property_staff
--   with elevated roles; the old RLS only matched properties.owner_id, so INSERT failed.
--   Align USING/WITH CHECK with company ownership, property ownership, and property_staff
--   (same role set as owners_managers_update_properties on properties).
-- NOTE: Idempotent (DROP POLICY IF EXISTS + CREATE POLICY)

DROP POLICY IF EXISTS "Owners manage booking slug aliases for own properties"
    ON public.property_booking_slug_aliases;
DROP POLICY IF EXISTS "Users manage booking slug aliases for accessible properties"
    ON public.property_booking_slug_aliases;

CREATE POLICY "Users manage booking slug aliases for accessible properties"
    ON public.property_booking_slug_aliases
    FOR ALL
    TO authenticated
    USING (
        property_id IN (
            SELECT id FROM public.properties WHERE owner_id = auth.uid()
        )
        OR property_id IN (
            SELECT p.id
            FROM public.properties p
            INNER JOIN public.companies c ON c.id = p.company_id
            WHERE c.owner_id = auth.uid()
        )
        OR property_id IN (
            SELECT ps.property_id
            FROM public.property_staff ps
            WHERE ps.user_id = auth.uid()
              AND ps.status IN ('active', 'pending')
              AND ps.role IN ('owner', 'admin', 'property_admin', 'manager')
        )
    )
    WITH CHECK (
        property_id IN (
            SELECT id FROM public.properties WHERE owner_id = auth.uid()
        )
        OR property_id IN (
            SELECT p.id
            FROM public.properties p
            INNER JOIN public.companies c ON c.id = p.company_id
            WHERE c.owner_id = auth.uid()
        )
        OR property_id IN (
            SELECT ps.property_id
            FROM public.property_staff ps
            WHERE ps.user_id = auth.uid()
              AND ps.status IN ('active', 'pending')
              AND ps.role IN ('owner', 'admin', 'property_admin', 'manager')
        )
    );

COMMENT ON POLICY "Users manage booking slug aliases for accessible properties"
    ON public.property_booking_slug_aliases IS
    'Property owner, company owner, or elevated property_staff may maintain slug aliases (matches properties update access).';
