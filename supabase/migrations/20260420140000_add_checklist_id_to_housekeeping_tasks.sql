-- Migration: add_checklist_id_to_housekeeping_tasks
-- Description: Adds optional checklist template reference on housekeeping tasks
-- Created: 2026-04-20

ALTER TABLE public.housekeeping_tasks
    ADD COLUMN IF NOT EXISTS checklist_id UUID REFERENCES public.checklist(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_checklist_id
    ON public.housekeeping_tasks (checklist_id);

COMMENT ON COLUMN public.housekeeping_tasks.checklist_id IS
    'Optional link to a checklist template used for this housekeeping task.';
