-- CC36-18-08: Add issue tracking columns to housekeeping_tasks
-- Supports the issue flag → maintenance WO handoff feature

ALTER TABLE housekeeping_tasks
  ADD COLUMN IF NOT EXISTS issue_type text CHECK (issue_type IN ('DAMAGE', 'MAINTENANCE')),
  ADD COLUMN IF NOT EXISTS issue_description text,
  ADD COLUMN IF NOT EXISTS linked_maintenance_task_id uuid REFERENCES maintenance_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_issue_type
  ON housekeeping_tasks(issue_type) WHERE issue_type IS NOT NULL;
