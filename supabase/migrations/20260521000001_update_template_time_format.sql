-- Update email templates to use formatted AM/PM time fields
-- instead of raw HH:mm 24-hour format for check-in/check-out times.

BEGIN;

-- Update email_templates table (tenant-specific templates)
UPDATE public.email_templates
SET html_template = replace(
    replace(
      html_template,
      '{{property.check_in_time}}',
      '{{property.formatted_check_in_time}}'
    ),
    '{{property.check_out_time}}',
    '{{property.formatted_check_out_time}}'
  )
WHERE slug IN ('check_in_reminder', 'welcome_email');

-- Update default_email_templates table (system seed templates)
UPDATE public.default_email_templates
SET html_template = replace(
    replace(
      html_template,
      '{{property.check_in_time}}',
      '{{property.formatted_check_in_time}}'
    ),
    '{{property.check_out_time}}',
    '{{property.formatted_check_out_time}}'
  )
WHERE slug IN ('check_in_reminder', 'welcome_email');

COMMIT;
