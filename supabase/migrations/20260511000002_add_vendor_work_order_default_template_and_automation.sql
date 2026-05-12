-- Migration: Add vendor_work_order_assigned default email template + default automation
-- Description: Adds a managed email template and automation for vendor work order assignment,
--              replacing the hardcoded React Email component with a pipeline-driven flow.
-- Created: 2026-05-11

BEGIN;

-- ============================================================================
-- A. Insert vendor_work_order_assigned into default_email_templates (idempotent upsert)
-- ============================================================================

INSERT INTO public.default_email_templates (slug, name, description, subject_template, html_template, category, status, version)
VALUES (
  'vendor_work_order_assigned',
  'Vendor Work Order Assignment',
  'Sent when a vendor is assigned to a maintenance work order',
  'Work Order Assignment — {{property_name}}',
  '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f4f4f5!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f4f4f5" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f4f5" style="width:100%;min-height:100%;background-color:#f4f4f5;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f4f4f5" style="width:100%;padding:40px 20px;background-color:#f4f4f5;vertical-align:top;"><table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;"><tr><td style="padding:28px 28px 22px;"><h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#18181b;">Work Order Invitation</h1><p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:22px;">Hello {{vendor_name}},</p><p style="margin:0 0 14px;font-size:14px;color:#3f3f46;line-height:22px;">You are invited to handle a maintenance work order for {{property_name}}.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;margin-bottom:14px;padding:14px;border-radius:10px;border:1px solid #e4e4e7;background-color:#fafafa;"><tr><td style="padding:0;"><p style="margin:0 0 8px;font-size:13px;color:#27272a;"><strong>Property:</strong> {{property_name}}</p><p style="margin:0 0 8px;font-size:13px;color:#27272a;"><strong>Work Order:</strong> {{work_order_number}}</p><p style="margin:0 0 8px;font-size:13px;color:#27272a;"><strong>Task:</strong> {{task_title}}</p><p style="margin:0 0 8px;font-size:13px;color:#27272a;"><strong>Site:</strong> {{site_label}}</p><p style="margin:0 0 8px;font-size:13px;color:#27272a;"><strong>Category:</strong> {{category}}</p><p style="margin:0 0 8px;font-size:13px;color:#27272a;"><strong>Priority:</strong> {{priority}}</p><p style="margin:0 0 0;font-size:13px;color:#27272a;"><strong>Estimated Labor Cost:</strong> {{estimated_labor_cost}}</p></td></tr></table><p style="margin:0;font-size:12px;color:#71717a;line-height:18px;">Contact {{property_email}} if you are interested.</p></td></tr></table></td></tr></table></body></html>',
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
-- B. Insert maintenance.task_created default automation (idempotent upsert on trigger_type)
-- ============================================================================

-- NOTE: The condition (vendor_id IS NOT NULL) is enforced at the application level
-- in triggerMaintenanceAutomations() — it skips the pipeline when no vendor is assigned.
-- This avoids adding a condition column to default_automations.

INSERT INTO public.default_automations (name, description, phase, scope, trigger_type, sort_order, actions, is_active)
VALUES (
  'Vendor Work Order Notification',
  'Sends a work order assignment email to the vendor when a maintenance task with a vendor is created',
  'COMMUNICATE',
  'property',
  'maintenance.task_created',
  9,
  '[{"action_type":"send_email","action_config":{"template":"vendor_work_order_assigned","recipient_source":"vendor"},"sort_order":0}]'::jsonb,
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
-- C. Backfill existing companies with the new vendor_work_order_assigned template
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
WHERE dt.slug = 'vendor_work_order_assigned'
  AND dt.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.email_templates et
    WHERE et.company_id = c.id
      AND et.property_id IS NULL
      AND et.slug = dt.slug
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- D. Backfill existing properties with the new maintenance.task_created automation
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
  WHERE da.trigger_type = 'maintenance.task_created'
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
