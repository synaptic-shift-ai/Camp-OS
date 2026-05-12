-- Migration: Add payment_receipt default email template + default automation
-- Description: Adds a managed email template and automation for payment receipts,
--              replacing the hardcoded React Email component with a pipeline-driven flow.
-- Created: 2026-05-11

BEGIN;

-- ============================================================================
-- A. Insert payment_receipt into default_email_templates (idempotent upsert)
-- ============================================================================

INSERT INTO public.default_email_templates (slug, name, description, subject_template, html_template, category, status, version)
VALUES (
  'payment_receipt',
  'Payment Receipt',
  'Sent to a guest when a payment is recorded against their reservation or account',
  'Payment Receipt #{{receipt_number}} — {{confirmation_number}} · {{property_name}}',
  $pr_html$<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f0f0f0!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}img{border:0;line-height:100%;outline:none;text-decoration:none;}</style></head><body bgcolor="#f0f0f0" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f0f0f0" style="width:100%;min-height:100%;background-color:#f0f0f0;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f0f0f0" style="width:100%;background-color:#f0f0f0;vertical-align:top;"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;margin:0 auto;background-color:#ffffff;"><tr><td style="padding:0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:36px 48px 48px 48px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:0;"><tr><td style="vertical-align:top;width:58%;"><p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111;line-height:22px;">{{property_name}}</p>{{property_address_lines_html}}</td><td style="vertical-align:top;width:42%;text-align:right;">&nbsp;</td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="height:20px;line-height:20px;font-size:20px;">&nbsp;</td></tr><tr><td style="border-top:1px solid #ddd;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr></table><p style="margin:0;padding:8px 0 0;text-align:right;color:#111;font-size:22px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">{{document_title}}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:24px 0 0;"><tr><td style="vertical-align:top;width:50%;padding-right:16px;"><p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111;">Billed to</p><p style="margin:0;font-size:13px;line-height:20px;color:#333;white-space:pre-line;">{{billed_to}}</p></td><td style="vertical-align:top;width:50%;text-align:right;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-left:auto;"><tr><td style="font-size:12px;font-weight:700;color:#333;padding:4px 12px 4px 0;text-align:right;vertical-align:top;">Receipt #</td><td style="font-size:12px;color:#111;padding:4px 0;text-align:right;vertical-align:top;">{{receipt_number}}</td></tr><tr><td style="font-size:12px;font-weight:700;color:#333;padding:4px 12px 4px 0;text-align:right;vertical-align:top;">Confirmation</td><td style="font-size:12px;color:#111;padding:4px 0;text-align:right;vertical-align:top;">{{confirmation_number}}</td></tr><tr><td style="font-size:12px;font-weight:700;color:#333;padding:4px 12px 4px 0;text-align:right;vertical-align:top;">Receipt date</td><td style="font-size:12px;color:#111;padding:4px 0;text-align:right;vertical-align:top;">{{receipt_date}}</td></tr></table></td></tr></table><p style="margin:0;padding:0;margin-top:28px;color:#555;font-size:13px;line-height:20px;">The following charges are on your account. This receipt reflects the payment recorded today.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:16px 0 0;"><tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #ddd;border-collapse:collapse;"><thead><tr><th style="background-color:#3d3d3d;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.06em;padding:10px 12px;text-align:left;text-transform:uppercase;width:44px;">QTY</th><th style="background-color:#3d3d3d;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.06em;padding:10px 12px;text-align:left;text-transform:uppercase;">Description</th><th style="background-color:#3d3d3d;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.06em;padding:10px 12px;text-align:right;text-transform:uppercase;width:96px;">Unit price</th><th style="background-color:#3d3d3d;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.06em;padding:10px 12px;text-align:right;text-transform:uppercase;width:96px;">Amount</th></tr></thead><tbody>{{line_items_html}}</tbody></table></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid #e5e5e5;padding:0 0 16px 0;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:8px 0 0;"><tr><td><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:280px;margin-left:auto;"><tr><td style="color:#555;font-size:13px;padding:6px 12px 6px 0;">Charges subtotal</td><td style="color:#111;font-size:13px;padding:6px 0;text-align:right;">{{subtotal}}</td></tr><tr><td style="color:#555;font-size:13px;padding:6px 12px 6px 0;">Amount paid (this receipt)</td><td style="color:#111;font-size:13px;padding:6px 0;text-align:right;font-weight:700;">{{amount_paid}}</td></tr><tr><td style="color:#555;font-size:13px;padding:6px 12px 6px 0;">Payment method</td><td style="color:#111;font-size:13px;padding:6px 0;text-align:right;">{{payment_method_label}}<span style="color:#777;font-weight:400;"> · {{payment_source_label}}</span></td></tr><tr><td style="color:#111;font-size:13px;padding:12px 12px 6px 0;font-weight:700;border-top:1px solid #ccc;">Remaining balance</td><td style="color:#111;font-size:15px;padding:12px 0 6px;text-align:right;font-weight:800;border-top:1px solid #ccc;">{{remaining_balance}}</td></tr></table></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="height:8px;line-height:8px;font-size:8px;">&nbsp;</td></tr><tr><td style="border-top:2px solid #111;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr><tr><td style="height:24px;line-height:24px;font-size:24px;">&nbsp;</td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:0;"><tr><td><p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111;">Notes</p><p style="margin:0 0 8px;font-size:13px;line-height:21px;color:#444;">Thank you for your payment. Please retain this receipt for your records. If you have questions about charges or payments, contact {{property_name}}{{property_contact_info}}.</p>{{reservation_totals_note}}</td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>$pr_html$,
  'payment',
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
-- B. Insert payment.received default automation (idempotent upsert on trigger_type)
-- ============================================================================

INSERT INTO public.default_automations (name, description, phase, scope, trigger_type, sort_order, actions, is_active)
VALUES (
  'Payment Receipt Email',
  'Sends a payment receipt email to the guest when a payment is recorded',
  'COMMUNICATE',
  'property',
  'payment.received',
  10,
  '[{"action_type":"send_email","action_config":{"template":"payment_receipt","recipient_source":"guest"},"sort_order":0}]'::jsonb,
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
-- C. Backfill existing companies with the new payment_receipt template
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
WHERE dt.slug = 'payment_receipt'
  AND dt.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.email_templates et
    WHERE et.company_id = c.id
      AND et.property_id IS NULL
      AND et.slug = dt.slug
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- D. Backfill existing properties with the new payment.received automation
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
  WHERE da.trigger_type = 'payment.received'
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
