BEGIN;
-- Drop the CHECK constraint that restricts email_templates.category to a fixed set of values.
-- This allows users to insert custom category names.
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_category_check;
COMMIT;
