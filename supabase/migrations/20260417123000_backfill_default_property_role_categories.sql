-- Backfill default role categories for existing properties.
-- Safe to re-run: unique constraint + ON CONFLICT DO NOTHING prevents duplicates.

BEGIN;

WITH default_categories(role, name) AS (
  VALUES
    ('admin'::text, 'Operations'::text),
    ('admin'::text, 'Finance'::text),
    ('admin'::text, 'Guest Services'::text),
    ('manager'::text, 'Housekeeping'::text),
    ('manager'::text, 'Maintenance'::text),
    ('manager'::text, 'Front Desk'::text),
    ('staff'::text, 'Housekeeping'::text),
    ('staff'::text, 'Maintenance'::text),
    ('staff'::text, 'Front Desk'::text)
)
INSERT INTO public.property_role_categories (property_id, role, name, access)
SELECT
  p.id AS property_id,
  dc.role,
  dc.name,
  '{}'::jsonb AS access
FROM public.properties p
CROSS JOIN default_categories dc
ON CONFLICT ON CONSTRAINT property_role_categories_property_role_name_key DO NOTHING;

COMMIT;
