-- Migration: add_maintenance_task_extended_fields
-- Description: Adds source/category/priority, cost estimates, and vendor fields to maintenance_tasks.
-- Created: 2026-04-22

ALTER TABLE public.maintenance_tasks
    ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'staff'
        CHECK (source IN ('guest', 'housekeeping', 'staff', 'pm', 'checkout')),
    ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'electrical'
        CHECK (category IN ('electrical', 'plumbing', 'facility', 'cleaning_issue')),
    ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'emergency')),
    ADD COLUMN IF NOT EXISTS estimated_labor_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS estimated_parts_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS vendor_name TEXT,
    ADD COLUMN IF NOT EXISTS vendor_email TEXT;

COMMENT ON COLUMN public.maintenance_tasks.source IS
    'Origin of task creation: guest, housekeeping, staff, pm, checkout.';
COMMENT ON COLUMN public.maintenance_tasks.category IS
    'Task category selected in maintenance UI.';
COMMENT ON COLUMN public.maintenance_tasks.priority IS
    'Relative urgency: low, medium, high, emergency.';
COMMENT ON COLUMN public.maintenance_tasks.estimated_labor_cost IS
    'Estimated labor spend in property currency.';
COMMENT ON COLUMN public.maintenance_tasks.estimated_parts_cost IS
    'Estimated parts/material spend in property currency.';
COMMENT ON COLUMN public.maintenance_tasks.vendor_name IS
    'Optional vendor/company name assigned to the task.';
COMMENT ON COLUMN public.maintenance_tasks.vendor_email IS
    'Optional vendor email contact.';

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_property_source
    ON public.maintenance_tasks (property_id, source);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_property_category
    ON public.maintenance_tasks (property_id, category);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_property_priority
    ON public.maintenance_tasks (property_id, priority);
