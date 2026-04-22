-- Migration: add_start_at_to_housekeeping_tasks
-- Description: Records when housekeeping work was actually started (distinct from start_date scheduling).
-- Created: 2026-04-22

ALTER TABLE public.housekeeping_tasks
    ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;

COMMENT ON COLUMN public.housekeeping_tasks.start_at IS
    'Timestamp when the task was started (e.g. status moved to in_progress). Nullable until started.';
