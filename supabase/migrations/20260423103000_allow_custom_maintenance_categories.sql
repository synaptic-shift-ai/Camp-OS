-- Migration: allow_custom_maintenance_categories
-- Description: Allows user-defined maintenance task categories instead of a fixed enum list.
-- Created: 2026-04-23

ALTER TABLE public.maintenance_tasks
    DROP CONSTRAINT IF EXISTS maintenance_tasks_category_check;

ALTER TABLE public.maintenance_tasks
    ALTER COLUMN category TYPE VARCHAR(120);

ALTER TABLE public.maintenance_tasks
    ADD CONSTRAINT maintenance_tasks_category_check
    CHECK (char_length(btrim(category)) > 0 AND char_length(category) <= 120);

COMMENT ON COLUMN public.maintenance_tasks.category IS
    'Task category selected in maintenance UI; supports standard and custom categories.';
