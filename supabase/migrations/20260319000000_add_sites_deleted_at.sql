-- Add soft-delete support for sites
-- Sites are no longer hard-deleted; instead we set deleted_at.

ALTER TABLE sites
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sites_property_id_deleted_at
ON sites(property_id, deleted_at);

