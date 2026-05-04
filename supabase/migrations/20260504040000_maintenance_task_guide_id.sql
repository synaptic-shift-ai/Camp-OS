-- Add guide_id to maintenance_tasks for linking work orders to maintenance guides
ALTER TABLE maintenance_tasks
  ADD COLUMN IF NOT EXISTS guide_id UUID NULL REFERENCES maintenance_guides(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_guide_id ON maintenance_tasks(guide_id) WHERE guide_id IS NOT NULL;
