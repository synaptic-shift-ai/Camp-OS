-- Migration: checklist_item_done
-- Description: Adds task-level checklist completion payload to housekeeping tasks
-- Created: 2026-04-20

ALTER TABLE public.housekeeping_tasks
    ADD COLUMN IF NOT EXISTS checklist_item_done JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_checklist_item_done_gin
    ON public.housekeeping_tasks
    USING GIN (checklist_item_done);

COMMENT ON COLUMN public.housekeeping_tasks.checklist_item_done IS
    'Task-level checklist completion state stored as JSON payload.';
