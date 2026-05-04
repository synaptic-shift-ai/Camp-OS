-- Issue flag → maintenance WO handoff on housekeeping tasks

ALTER TABLE public.housekeeping_tasks
  ADD COLUMN IF NOT EXISTS issue_type text CHECK (issue_type IN ('DAMAGE', 'MAINTENANCE')),
  ADD COLUMN IF NOT EXISTS issue_description text,
  ADD COLUMN IF NOT EXISTS linked_maintenance_task_id uuid REFERENCES public.maintenance_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_issue_type
  ON public.housekeeping_tasks (issue_type) WHERE issue_type IS NOT NULL;
