-- Allow invoice attachments to use task_type maintenance_invoice (UI + API already send this value).
-- Previously CHECK only allowed housekeeping | maintenance, so inserts failed silently from the user's perspective
-- (storage upload succeeded; DB row rejected).

ALTER TABLE public.task_images
  DROP CONSTRAINT IF EXISTS task_images_task_type_check;

ALTER TABLE public.task_images
  ADD CONSTRAINT task_images_task_type_check
  CHECK (task_type IN ('housekeeping', 'maintenance', 'maintenance_invoice'));

COMMENT ON COLUMN public.task_images.task_type IS
  'Task module discriminator: housekeeping, maintenance (photos), or maintenance_invoice (vendor invoices).';
