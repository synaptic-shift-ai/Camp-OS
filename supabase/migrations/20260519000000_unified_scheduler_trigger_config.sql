-- ============================================================================
-- Unified Scheduler: Populate trigger_config for existing scheduled automations
--
-- Phase 2 migration: populates trigger_config JSONB for all automations
-- with scheduled trigger types that have empty/null trigger_config.
-- Also updates default_automations seed data so new properties get proper config.
--
-- Idempotent: only touches rows where trigger_config is empty/null.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Update existing automations
-- ---------------------------------------------------------------------------

-- Check-in Reminder automations
UPDATE automations
SET trigger_config = jsonb_build_object(
  'schedule', '0 8 * * *',
  'timezone', 'UTC',
  'target', 'reservations',
  'dateField', 'check_in_date',
  'offsetDays', 0,
  'status', 'confirmed',
  'dedupeWindow', 'day'
)
WHERE trigger_type = 'system.check_in_reminder'
  AND (trigger_config = '{}'::jsonb OR trigger_config IS NULL OR trigger_config = 'null'::jsonb);

-- Pre-arrival Reminder automations
UPDATE automations
SET trigger_config = jsonb_build_object(
  'schedule', '0 8 * * *',
  'timezone', 'UTC',
  'target', 'reservations',
  'dateField', 'check_in_date',
  'offsetDays', -2,
  'status', 'confirmed',
  'dedupeWindow', 'day'
)
WHERE trigger_type = 'system.pre_arrival_reminder'
  AND (trigger_config = '{}'::jsonb OR trigger_config IS NULL OR trigger_config = 'null'::jsonb);

-- Check-out Reminder automations
UPDATE automations
SET trigger_config = jsonb_build_object(
  'schedule', '0 8 * * *',
  'timezone', 'UTC',
  'target', 'reservations',
  'dateField', 'check_out_date',
  'offsetDays', 0,
  'status', 'checked_in',
  'dedupeWindow', 'day'
)
WHERE trigger_type = 'system.check_out_reminder'
  AND (trigger_config = '{}'::jsonb OR trigger_config IS NULL OR trigger_config = 'null'::jsonb);

-- Generic scheduled automations (hourly, property-scoped)
UPDATE automations
SET trigger_config = jsonb_build_object(
  'schedule', '0 * * * *',
  'timezone', 'UTC',
  'target', 'property',
  'dedupeWindow', 'hour'
)
WHERE trigger_type = 'system.scheduled'
  AND (trigger_config = '{}'::jsonb OR trigger_config IS NULL OR trigger_config = 'null'::jsonb);

-- ---------------------------------------------------------------------------
-- B. Update default_automations seed data
--    (so new properties get proper trigger_config via seed-defaults.ts)
-- ---------------------------------------------------------------------------

UPDATE default_automations
SET trigger_config = jsonb_build_object(
  'schedule', '0 8 * * *',
  'timezone', 'UTC',
  'target', 'reservations',
  'dateField', 'check_in_date',
  'offsetDays', 0,
  'status', 'confirmed',
  'dedupeWindow', 'day'
),
version = version + 1
WHERE trigger_type = 'system.check_in_reminder';

UPDATE default_automations
SET trigger_config = jsonb_build_object(
  'schedule', '0 8 * * *',
  'timezone', 'UTC',
  'target', 'reservations',
  'dateField', 'check_in_date',
  'offsetDays', -2,
  'status', 'confirmed',
  'dedupeWindow', 'day'
),
version = version + 1
WHERE trigger_type = 'system.pre_arrival_reminder';

UPDATE default_automations
SET trigger_config = jsonb_build_object(
  'schedule', '0 8 * * *',
  'timezone', 'UTC',
  'target', 'reservations',
  'dateField', 'check_out_date',
  'offsetDays', 0,
  'status', 'checked_in',
  'dedupeWindow', 'day'
),
version = version + 1
WHERE trigger_type = 'system.check_out_reminder';

UPDATE default_automations
SET trigger_config = jsonb_build_object(
  'schedule', '0 * * * *',
  'timezone', 'UTC',
  'target', 'property',
  'dedupeWindow', 'hour'
),
version = version + 1
WHERE trigger_type = 'system.scheduled';

