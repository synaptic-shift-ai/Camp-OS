-- ============================================================================
-- Backfill property settings timezone
--
-- Scheduled automations now use properties.settings.timezone as their source of
-- truth. Backfill existing properties from the legacy top-level timezone column
-- so older rows do not silently fall back to UTC.
-- ============================================================================

UPDATE properties
SET settings = COALESCE(settings, '{}'::jsonb)
  || jsonb_build_object(
    'timezone',
    COALESCE(
      NULLIF(settings->>'timezone', ''),
      NULLIF(timezone, ''),
      'America/New_York'
    )
  )
WHERE settings IS NULL
   OR settings->>'timezone' IS NULL
   OR settings->>'timezone' = '';
