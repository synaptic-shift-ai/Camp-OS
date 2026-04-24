-- Migration: extend_maintenance_task_lifecycle
-- NOTE: Made idempotent for branch creation support
-- Description: Extends maintenance_tasks with on_hold/cancelled statuses and lifecycle timestamps
-- Created: 2026-04-24

-- ============================================================================
-- Extend status CHECK constraint
-- ============================================================================

ALTER TABLE public.maintenance_tasks DROP CONSTRAINT IF EXISTS maintenance_tasks_status_check;

ALTER TABLE public.maintenance_tasks ADD CONSTRAINT maintenance_tasks_status_check
    CHECK (status IN ('open', 'in_progress', 'on_hold', 'completed', 'cancelled'));

-- ============================================================================
-- Lifecycle timestamp columns
-- ============================================================================

ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS on_hold_at TIMESTAMPTZ;
ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS on_hold_reason TEXT;
ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

COMMENT ON COLUMN public.maintenance_tasks.started_at IS
    'Timestamp when the task moved to in_progress.';
COMMENT ON COLUMN public.maintenance_tasks.completed_at IS
    'Timestamp when the task was marked completed.';
COMMENT ON COLUMN public.maintenance_tasks.on_hold_at IS
    'Timestamp when the task was placed on hold.';
COMMENT ON COLUMN public.maintenance_tasks.on_hold_reason IS
    'Optional reason the task was placed on hold.';
COMMENT ON COLUMN public.maintenance_tasks.cancelled_at IS
    'Timestamp when the task was cancelled.';
COMMENT ON COLUMN public.maintenance_tasks.cancelled_reason IS
    'Optional reason the task was cancelled.';
