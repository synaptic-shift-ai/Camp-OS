-- ============================================================================
-- Remove timezone from trigger_config
--
-- Timezone is now read from the property's settings.timezone field.
-- This strips the 'timezone' key from all existing trigger_config values
-- so there is no stale/duplicate timezone data.
--
-- Idempotent: jsonb - (remove) on a key that doesn't exist is a no-op,
-- and the WHERE clause only touches rows that still have the key.
-- ============================================================================

UPDATE automations
SET trigger_config = trigger_config - 'timezone'
WHERE trigger_type IN (
  'system.scheduled',
  'system.check_in_reminder',
  'system.pre_arrival_reminder',
  'system.check_out_reminder'
)
AND trigger_config ? 'timezone';

UPDATE default_automations
SET trigger_config = trigger_config - 'timezone',
    version = version + 1
WHERE trigger_type IN (
  'system.scheduled',
  'system.check_in_reminder',
  'system.pre_arrival_reminder',
  'system.check_out_reminder'
)
AND trigger_config ? 'timezone';
