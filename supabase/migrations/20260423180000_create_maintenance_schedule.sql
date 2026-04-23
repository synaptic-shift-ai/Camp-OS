-- Migration: create_maintenance_schedule
-- Description: Recurring / preventive maintenance schedules per property.
-- Notes:
--   - site_id NULL = applies to all sites on the property.
--   - schedule_date is the nullable calendar anchor (requested as "date" in spec).
--   - days is free-form / JSON-friendly text (e.g. weekday list); nullable.
-- Created: 2026-04-23

CREATE TABLE IF NOT EXISTS public.maintenance_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.property_staff(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL,
    days TEXT,
    schedule_date DATE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.maintenance_schedule IS
    'Preventive / recurring maintenance schedules for a property.';
COMMENT ON COLUMN public.maintenance_schedule.site_id IS
    'When NULL, the schedule applies to all sites on the property.';
COMMENT ON COLUMN public.maintenance_schedule.assigned_to IS
    'property_staff.id of the assignee, when set.';
COMMENT ON COLUMN public.maintenance_schedule.frequency IS
    'Recurrence label (e.g. weekly, monthly); app-defined values.';
COMMENT ON COLUMN public.maintenance_schedule.days IS
    'Optional day specification (comma list, JSON, or interval—interpreted by the app).';
COMMENT ON COLUMN public.maintenance_schedule.schedule_date IS
    'Optional calendar anchor for the next run or start (spec "date").';

CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_property_id
    ON public.maintenance_schedule (property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_site_id
    ON public.maintenance_schedule (site_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_assigned_to
    ON public.maintenance_schedule (assigned_to);

-- ============================================================================
-- Row Level Security (aligned with maintenance_tasks)
-- ============================================================================

ALTER TABLE public.maintenance_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on maintenance_schedule"
    ON public.maintenance_schedule;
CREATE POLICY "Service role full access on maintenance_schedule"
    ON public.maintenance_schedule
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "maintenance_schedule_select_authenticated"
    ON public.maintenance_schedule;
CREATE POLICY "maintenance_schedule_select_authenticated"
    ON public.maintenance_schedule
    FOR SELECT
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

DROP POLICY IF EXISTS "maintenance_schedule_insert_authenticated"
    ON public.maintenance_schedule;
CREATE POLICY "maintenance_schedule_insert_authenticated"
    ON public.maintenance_schedule
    FOR INSERT
    TO authenticated
    WITH CHECK (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    );

DROP POLICY IF EXISTS "maintenance_schedule_update_authenticated"
    ON public.maintenance_schedule;
CREATE POLICY "maintenance_schedule_update_authenticated"
    ON public.maintenance_schedule
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

DROP POLICY IF EXISTS "maintenance_schedule_delete_authenticated"
    ON public.maintenance_schedule;
CREATE POLICY "maintenance_schedule_delete_authenticated"
    ON public.maintenance_schedule
    FOR DELETE
    TO authenticated
    USING (public.is_property_owner(property_id) OR public.is_property_staff(property_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_schedule TO authenticated;
GRANT ALL ON public.maintenance_schedule TO service_role;

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_maintenance_schedule_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_maintenance_schedule_updated_at
    ON public.maintenance_schedule;
CREATE TRIGGER trigger_update_maintenance_schedule_updated_at
    BEFORE UPDATE ON public.maintenance_schedule
    FOR EACH ROW
    EXECUTE FUNCTION public.update_maintenance_schedule_updated_at();
