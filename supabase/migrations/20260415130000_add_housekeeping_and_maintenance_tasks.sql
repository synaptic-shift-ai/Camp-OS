-- Migration: add_housekeeping_and_maintenance_tasks
-- NOTE: Made idempotent for branch creation support
-- Description: Adds property-scoped task tables for housekeeping and maintenance modules
-- Created: 2026-04-15

-- ============================================================================
-- Housekeeping tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    staff_id UUID REFERENCES public.property_staff(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'done')),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_property_id
    ON public.housekeeping_tasks (property_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_property_status
    ON public.housekeeping_tasks (property_id, status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_staff_id
    ON public.housekeeping_tasks (staff_id);

COMMENT ON TABLE public.housekeeping_tasks IS
    'Property-scoped housekeeping work items.';

-- ============================================================================
-- Maintenance tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    staff_id UUID REFERENCES public.property_staff(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'completed')),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_property_id
    ON public.maintenance_tasks (property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_property_status
    ON public.maintenance_tasks (property_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_staff_id
    ON public.maintenance_tasks (staff_id);

COMMENT ON TABLE public.maintenance_tasks IS
    'Property-scoped maintenance work items.';

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on housekeeping_tasks"
    ON public.housekeeping_tasks;
CREATE POLICY "Service role full access on housekeeping_tasks"
    ON public.housekeeping_tasks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "housekeeping_tasks_select_authenticated"
    ON public.housekeeping_tasks;
CREATE POLICY "housekeeping_tasks_select_authenticated"
    ON public.housekeeping_tasks
    FOR SELECT
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

DROP POLICY IF EXISTS "housekeeping_tasks_insert_authenticated"
    ON public.housekeeping_tasks;
CREATE POLICY "housekeeping_tasks_insert_authenticated"
    ON public.housekeeping_tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    );

DROP POLICY IF EXISTS "housekeeping_tasks_update_authenticated"
    ON public.housekeeping_tasks;
CREATE POLICY "housekeeping_tasks_update_authenticated"
    ON public.housekeeping_tasks
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

DROP POLICY IF EXISTS "housekeeping_tasks_delete_authenticated"
    ON public.housekeeping_tasks;
CREATE POLICY "housekeeping_tasks_delete_authenticated"
    ON public.housekeeping_tasks
    FOR DELETE
    TO authenticated
    USING (public.is_property_owner(property_id) OR public.is_property_staff(property_id));

DROP POLICY IF EXISTS "Service role full access on maintenance_tasks"
    ON public.maintenance_tasks;
CREATE POLICY "Service role full access on maintenance_tasks"
    ON public.maintenance_tasks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "maintenance_tasks_select_authenticated"
    ON public.maintenance_tasks;
CREATE POLICY "maintenance_tasks_select_authenticated"
    ON public.maintenance_tasks
    FOR SELECT
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

DROP POLICY IF EXISTS "maintenance_tasks_insert_authenticated"
    ON public.maintenance_tasks;
CREATE POLICY "maintenance_tasks_insert_authenticated"
    ON public.maintenance_tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    );

DROP POLICY IF EXISTS "maintenance_tasks_update_authenticated"
    ON public.maintenance_tasks;
CREATE POLICY "maintenance_tasks_update_authenticated"
    ON public.maintenance_tasks
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

DROP POLICY IF EXISTS "maintenance_tasks_delete_authenticated"
    ON public.maintenance_tasks;
CREATE POLICY "maintenance_tasks_delete_authenticated"
    ON public.maintenance_tasks
    FOR DELETE
    TO authenticated
    USING (public.is_property_owner(property_id) OR public.is_property_staff(property_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.housekeeping_tasks TO authenticated;
GRANT ALL ON public.housekeeping_tasks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tasks TO authenticated;
GRANT ALL ON public.maintenance_tasks TO service_role;

-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_housekeeping_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_housekeeping_tasks_updated_at
    ON public.housekeeping_tasks;
CREATE TRIGGER trigger_update_housekeeping_tasks_updated_at
    BEFORE UPDATE ON public.housekeeping_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_housekeeping_tasks_updated_at();

CREATE OR REPLACE FUNCTION public.update_maintenance_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_maintenance_tasks_updated_at
    ON public.maintenance_tasks;
CREATE TRIGGER trigger_update_maintenance_tasks_updated_at
    BEFORE UPDATE ON public.maintenance_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_maintenance_tasks_updated_at();
