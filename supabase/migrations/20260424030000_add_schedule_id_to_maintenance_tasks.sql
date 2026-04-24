-- Migration: add_schedule_id_to_maintenance_tasks
-- Description: Adds schedule_id FK to maintenance_tasks so PM work orders
--              can be linked back to their source schedule for
--              completion-triggered auto-generation.
-- Created: 2026-04-24

ALTER TABLE public.maintenance_tasks
    ADD COLUMN IF NOT EXISTS schedule_id UUID
        REFERENCES public.maintenance_schedule(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.maintenance_tasks.schedule_id IS
    'Nullable FK to maintenance_schedule. Populated when the task was generated from a PM schedule.';

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_schedule_id
    ON public.maintenance_tasks (schedule_id);
