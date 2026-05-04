-- CC41-04-16: Add scheduled_start and due_date to maintenance_tasks
-- scheduled_start = planned start time (optional, set when creating/scheduling a task)
-- due_date = absolute deadline, auto-derived from scheduled_start + sla or started_at + sla

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

COMMENT ON COLUMN public.maintenance_tasks.scheduled_start IS 'Planned start time for the maintenance task';
COMMENT ON COLUMN public.maintenance_tasks.due_date IS 'Absolute deadline; derived from scheduled_start + sla or started_at + sla';
