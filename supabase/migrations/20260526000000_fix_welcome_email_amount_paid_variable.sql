-- Migration: Fix welcome_email template to use reservation.formatted_paid_amount
-- instead of payment.formatted_amount for the "Amount Paid" field.
--
-- The booking confirmation email previously showed the latest financial
-- transaction amount as "Amount Paid". For multi-payment bookings or
-- adjusted ledgers this was incorrect. The new variable
-- reservation.formatted_paid_amount always reflects the cumulative
-- paid_amount from the reservation row.

BEGIN;

-- 1. Update default_email_templates (global master)
UPDATE public.default_email_templates
SET html_template = REPLACE(
  html_template,
  '{{payment.formatted_amount}}',
  '{{reservation.formatted_paid_amount}}'
),
version = version + 1,
updated_at = now()
WHERE slug = 'welcome_email'
  AND html_template LIKE '%{{payment.formatted_amount}}%';

-- 2. Update per-company/per-property email_templates that haven't been modified
UPDATE public.email_templates
SET html_template = REPLACE(
  html_template,
  '{{payment.formatted_amount}}',
  '{{reservation.formatted_paid_amount}}'
),
default_version = (
  SELECT version FROM public.default_email_templates WHERE slug = 'welcome_email'
)
WHERE slug = 'welcome_email'
  AND (is_modified IS NULL OR is_modified = false)
  AND html_template LIKE '%{{payment.formatted_amount}}%';

COMMIT;
