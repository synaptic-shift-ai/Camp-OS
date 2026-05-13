-- Migration: Pre-arrival reminder automation (2 days before check-in)
-- Description: Seeds default_automation for system.pre_arrival_reminder and backfills
--              properties that completed onboarding. Cron route calls this trigger daily.
-- Note: default_email_templates already includes slug pre_arrival (20260429000001).

BEGIN;

INSERT INTO public.default_automations (name, description, phase, scope, trigger_type, sort_order, actions, is_active)
VALUES (
  'Pre-Arrival Reminder Email',
  'Sends the pre-arrival email 2 days before check-in',
  'COMMUNICATE',
  'property',
  'system.pre_arrival_reminder',
  6,
  '[{"action_type":"send_email","action_config":{"template":"pre_arrival"},"sort_order":0}]'::jsonb,
  true
)
ON CONFLICT (trigger_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  actions = EXCLUDED.actions,
  version = default_automations.version + 1,
  updated_at = now();

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
    COALESCE(da.trigger_config, '{}'::jsonb),
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
  WHERE da.trigger_type = 'system.pre_arrival_reminder'
    AND da.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.automations a
      WHERE a.property_id = ep.property_id
        AND a.company_id = ep.company_id
        AND a.trigger_type = da.trigger_type
        AND a.phase = da.phase
    )
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
CROSS JOIN LATERAL jsonb_array_elements(da.actions) AS act;

COMMIT;
