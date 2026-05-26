-- Migration: Add staff_account_setup default email template + staff.created default automation
-- Description: Adds a managed email template and automation for staff account setup,
--              triggered when a staff member is created directly (not invited).
-- Created: 2026-05-26

BEGIN;

-- ============================================================================
-- A. Insert staff_account_setup into default_email_templates (idempotent upsert)
-- ============================================================================

INSERT INTO public.default_email_templates (slug, name, description, subject_template, html_template, category, status, version)
VALUES (
  'staff_account_setup',
  'Staff Account Setup',
  'Sent when a staff member is created and needs to set up their account',
  'Set up your {{property.name}} account',
  '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f4f4f5!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f4f4f5" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f4f5" style="width:100%;min-height:100%;background-color:#f4f4f5;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f4f4f5" style="width:100%;padding:40px 20px;background-color:#f4f4f5;vertical-align:top;"><table role="presentation" width="460" cellspacing="0" cellpadding="0" border="0" style="max-width:460px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;"><tr><td style="padding:32px 32px 24px;"><h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Set up your Camp OS account</h1><p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:22px;">{{inviter_name}} has added you as staff at <strong>{{property.name}}</strong>. Click the button below to set up your account and choose your password.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;"><tr><td align="center" style="padding:0;"><a href="{{invite_url}}" style="display:inline-block;padding:14px 32px;background:linear-gradient(to right,#ef4444,#ec4899);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">Set up your account</a></td></tr></table><p style="margin:0 0 16px;font-size:13px;color:#71717a;">Or copy and paste this link into your browser:</p><p style="margin:0 0 24px;font-size:12px;color:#52525b;word-break:break-all;line-height:18px;">{{invite_url}}</p><p style="margin:0;font-size:13px;color:#71717a;line-height:20px;">This link expires in {{expiry_days}} days. If you didn''t expect this email, you can ignore it.</p></td></tr></table></td></tr></table></body></html>',
  'notification',
  'active',
  1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  category = EXCLUDED.category,
  version = default_email_templates.version + 1,
  updated_at = now();

-- ============================================================================
-- B. Insert staff.created default automation (idempotent upsert on trigger_type)
-- ============================================================================

INSERT INTO public.default_automations (name, description, phase, scope, trigger_type, sort_order, actions, is_active)
VALUES (
  'Staff Account Setup Email',
  'Sends a setup email when a staff member is created directly',
  'COMMUNICATE',
  'property',
  'staff.created',
  9,
  '[{"action_type":"send_email","action_config":{"template":"staff_account_setup","recipient_source":"staff"},"sort_order":0}]'::jsonb,
  true
)
ON CONFLICT (trigger_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  actions = EXCLUDED.actions,
  version = default_automations.version + 1,
  updated_at = now();

-- ============================================================================
-- C. Backfill existing companies with the new staff_account_setup template
-- ============================================================================

INSERT INTO public.email_templates (
  company_id, property_id, slug, name, description,
  subject_template, html_template, category,
  is_system_default, status, is_modified, default_version
)
SELECT
  c.id,
  NULL,
  dt.slug,
  dt.name,
  dt.description,
  dt.subject_template,
  dt.html_template,
  dt.category,
  true,
  'active',
  false,
  dt.version
FROM public.companies c
CROSS JOIN public.default_email_templates dt
WHERE dt.slug = 'staff_account_setup'
  AND dt.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.email_templates et
    WHERE et.company_id = c.id
      AND et.property_id IS NULL
      AND et.slug = dt.slug
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- D. Backfill existing properties with the new staff.created automation
-- ============================================================================

WITH inserted_automations AS (
  INSERT INTO public.automations (
    id, company_id, property_id, name, description,
    phase, scope, is_active, trigger_type, trigger_config,
    sort_order, is_modified, default_version,
    created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    ep.company_id,
    ep.property_id,
    da.name,
    da.description,
    da.phase,
    COALESCE(da.scope, 'property'),
    da.is_active,
    da.trigger_type,
    da.trigger_config,
    da.sort_order,
    false,
    da.version,
    now(),
    now()
  FROM (
    SELECT p.id AS property_id, p.company_id
    FROM public.properties p
    WHERE p.onboarding_completed = true
  ) ep
  CROSS JOIN public.default_automations da
  WHERE da.trigger_type = 'staff.created'
    AND da.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.automations a
      WHERE a.property_id = ep.property_id
        AND a.company_id = ep.company_id
        AND a.trigger_type = da.trigger_type
        AND a.phase = da.phase
    )
  ON CONFLICT DO NOTHING
  RETURNING id, company_id, property_id, trigger_type
)
INSERT INTO public.automation_actions (
  id, automation_id, action_type, action_config, sort_order, created_at
)
SELECT
  gen_random_uuid(),
  ia.id,
  act->>'action_type',
  COALESCE(act->'action_config', '{}'::jsonb),
  COALESCE((act->>'sort_order')::integer, 0),
  now()
FROM inserted_automations ia
JOIN public.default_automations da ON da.trigger_type = ia.trigger_type
CROSS JOIN LATERAL jsonb_array_elements(da.actions) AS act
ON CONFLICT DO NOTHING;

COMMIT;
