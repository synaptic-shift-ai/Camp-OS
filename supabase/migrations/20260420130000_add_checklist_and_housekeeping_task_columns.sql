-- Migration: add_checklist_and_housekeeping_task_columns
-- Description: Adds property-scoped checklist table; extends housekeeping_tasks with
--              reservation link, priority, and scheduled window (timestamps).
-- Created: 2026-04-20

-- ============================================================================
-- Checklist (property-scoped templates / definitions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    item JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_property_id
    ON public.checklist (property_id);

COMMENT ON TABLE public.checklist IS
    'Property-scoped checklist definitions with structured items stored as JSON.';

-- ============================================================================
-- Housekeeping tasks: reservation, priority, schedule window
-- ============================================================================

ALTER TABLE public.housekeeping_tasks
    ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_reservation_id
    ON public.housekeeping_tasks (reservation_id);

COMMENT ON COLUMN public.housekeeping_tasks.reservation_id IS
    'Optional link to the reservation this task is associated with.';
COMMENT ON COLUMN public.housekeeping_tasks.priority IS
    'Relative urgency: low, medium, high, urgent.';
COMMENT ON COLUMN public.housekeeping_tasks.start_date IS
    'Scheduled start (date and time in UTC).';
COMMENT ON COLUMN public.housekeeping_tasks.end_date IS
    'Scheduled end (date and time in UTC).';

-- ============================================================================
-- Row Level Security (checklist)
-- ============================================================================

ALTER TABLE public.checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on checklist"
    ON public.checklist;
CREATE POLICY "Service role full access on checklist"
    ON public.checklist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "checklist_select_authenticated"
    ON public.checklist;
CREATE POLICY "checklist_select_authenticated"
    ON public.checklist
    FOR SELECT
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

DROP POLICY IF EXISTS "checklist_insert_authenticated"
    ON public.checklist;
CREATE POLICY "checklist_insert_authenticated"
    ON public.checklist
    FOR INSERT
    TO authenticated
    WITH CHECK (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    );

DROP POLICY IF EXISTS "checklist_update_authenticated"
    ON public.checklist;
CREATE POLICY "checklist_update_authenticated"
    ON public.checklist
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

DROP POLICY IF EXISTS "checklist_delete_authenticated"
    ON public.checklist;
CREATE POLICY "checklist_delete_authenticated"
    ON public.checklist
    FOR DELETE
    TO authenticated
    USING (public.is_property_owner(property_id) OR public.is_property_staff(property_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist TO authenticated;
GRANT ALL ON public.checklist TO service_role;

-- ============================================================================
-- updated_at trigger (checklist)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_checklist_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_checklist_updated_at
    ON public.checklist;
CREATE TRIGGER trigger_update_checklist_updated_at
    BEFORE UPDATE ON public.checklist
    FOR EACH ROW
    EXECUTE FUNCTION public.update_checklist_updated_at();
