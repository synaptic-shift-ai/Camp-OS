-- Migration: property_vendor_and_maintenance_vendor_sla
-- Description: Adds property_vendor table; links maintenance_tasks via vendor_id; adds sla; removes legacy vendor columns.
-- Created: 2026-04-23

-- ============================================================================
-- property_vendor
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.property_vendor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    service_type TEXT NOT NULL DEFAULT 'general',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_vendor_property_id
    ON public.property_vendor (property_id);

COMMENT ON TABLE public.property_vendor IS
    'External vendors/service providers scoped to a property.';
COMMENT ON COLUMN public.property_vendor.service_type IS
    'Primary service offered (e.g. HVAC, plumbing).';

ALTER TABLE public.property_vendor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on property_vendor"
    ON public.property_vendor;
CREATE POLICY "Service role full access on property_vendor"
    ON public.property_vendor
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "property_vendor_select_authenticated"
    ON public.property_vendor;
CREATE POLICY "property_vendor_select_authenticated"
    ON public.property_vendor
    FOR SELECT
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

DROP POLICY IF EXISTS "property_vendor_insert_authenticated"
    ON public.property_vendor;
CREATE POLICY "property_vendor_insert_authenticated"
    ON public.property_vendor
    FOR INSERT
    TO authenticated
    WITH CHECK (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    );

DROP POLICY IF EXISTS "property_vendor_update_authenticated"
    ON public.property_vendor;
CREATE POLICY "property_vendor_update_authenticated"
    ON public.property_vendor
    FOR UPDATE
    TO authenticated
    USING (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    )
    WITH CHECK (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    );

DROP POLICY IF EXISTS "property_vendor_delete_authenticated"
    ON public.property_vendor;
CREATE POLICY "property_vendor_delete_authenticated"
    ON public.property_vendor
    FOR DELETE
    TO authenticated
    USING (public.is_property_owner(property_id) OR public.is_property_staff(property_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_vendor TO authenticated;
GRANT ALL ON public.property_vendor TO service_role;

CREATE OR REPLACE FUNCTION public.update_property_vendor_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_property_vendor_updated_at
    ON public.property_vendor;
CREATE TRIGGER trigger_update_property_vendor_updated_at
    BEFORE UPDATE ON public.property_vendor
    FOR EACH ROW
    EXECUTE FUNCTION public.update_property_vendor_updated_at();

-- ============================================================================
-- maintenance_tasks: vendor_id, sla; drop vendor_name / vendor_email
-- ============================================================================

ALTER TABLE public.maintenance_tasks
    ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.property_vendor(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sla INTEGER;

COMMENT ON COLUMN public.maintenance_tasks.vendor_id IS
    'Optional link to a property-scoped vendor record.';
COMMENT ON COLUMN public.maintenance_tasks.sla IS
    'Service-level target for this task (e.g. resolution window in hours).';

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_vendor_id
    ON public.maintenance_tasks (vendor_id);

ALTER TABLE public.maintenance_tasks
    DROP COLUMN IF EXISTS vendor_name,
    DROP COLUMN IF EXISTS vendor_email;
