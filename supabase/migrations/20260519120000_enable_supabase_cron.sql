-- ============================================================
-- Supabase Cron Setup (pg_cron + pg_net)
-- ============================================================
-- Enables database-level scheduling that calls API routes via HTTP.
-- Secrets are stored in a locked-down config table (never in cron.job.command).
--
-- Usage:
--   SELECT setup_cron_jobs('https://your-app.vercel.app', 'your-cron-secret');
--
-- Teardown:
--   SELECT teardown_cron_jobs();
-- ============================================================

-- Enable pg_cron for database-level scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';

-- Re-enable pg_net for outbound HTTP requests (was dropped in 20260226072133)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
COMMENT ON EXTENSION pg_net IS 'HTTP client for PostgreSQL';

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA extensions TO postgres;

-- ============================================================
-- Restricted config table for cron secrets
-- ============================================================
-- RLS enabled with NO policies = only service_role (which bypasses RLS)
-- can read/write. anon and authenticated roles are blocked entirely.
-- ============================================================

CREATE TABLE IF NOT EXISTS _cron_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE _cron_config ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: makes the authenticated HTTP call
-- ============================================================
-- Reads app_url and cron_secret from _cron_config at runtime.
-- SECURITY DEFINER so it runs with creator (postgres) privileges.
-- The cron command only calls this function — no secrets leak into cron.job.
-- ============================================================

CREATE OR REPLACE FUNCTION _cron_call_app(route text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions, cron, pg_catalog
AS $$
DECLARE
  v_app_url text;
  v_cron_secret text;
BEGIN
  SELECT value INTO v_app_url FROM public._cron_config WHERE key = 'app_url';
  SELECT value INTO v_cron_secret FROM public._cron_config WHERE key = 'cron_secret';

  IF v_app_url IS NULL OR v_cron_secret IS NULL THEN
    RAISE EXCEPTION 'Cron config not set. Run setup_cron_jobs() first.';
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_app_url, '/') || route,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- ============================================================
-- Setup function: stores config and registers cron jobs
-- ============================================================
-- Idempotent — safe to call multiple times.
-- Uses cron.unschedule / cron.schedule (official pg_cron API).
-- ============================================================

CREATE OR REPLACE FUNCTION setup_cron_jobs(p_app_url text, p_cron_secret text)
RETURNS void
LANGUAGE plpgsql
AS $setup$
BEGIN
  -- Store / update config (upsert)
  INSERT INTO _cron_config (key, value) VALUES ('app_url', p_app_url)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO _cron_config (key, value) VALUES ('cron_secret', p_cron_secret)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  -- Unschedule existing jobs (idempotent — ignores "not found")
  BEGIN
    PERFORM cron.unschedule('campos-automation-scheduler');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-automation-scheduler not found, skipping unschedule';
  END;
  BEGIN
    PERFORM cron.unschedule('campos-cleanup-expired-reservations');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-cleanup-expired-reservations not found, skipping unschedule';
  END;
  BEGIN
    PERFORM cron.unschedule('campos-update-housekeeping-status');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-update-housekeeping-status not found, skipping unschedule';
  END;

  -- Unified Automation Scheduler — every 5 minutes
  PERFORM cron.schedule(
    'campos-automation-scheduler',
    '*/5 * * * *',
    $$SELECT _cron_call_app('/api/cron/automation-scheduled')$$
  );

  -- Cleanup Expired Reservations — every 5 minutes
  PERFORM cron.schedule(
    'campos-cleanup-expired-reservations',
    '*/5 * * * *',
    $$SELECT _cron_call_app('/api/cron/cleanup-expired-reservations')$$
  );

  -- Update Housekeeping Status — daily at midnight UTC
  PERFORM cron.schedule(
    'campos-update-housekeeping-status',
    '0 0 * * *',
    $$SELECT _cron_call_app('/api/cron/update-housekeeping-status')$$
  );

  RAISE NOTICE 'CampOS cron jobs registered: 3 jobs active';
END;
$setup$;

-- ============================================================
-- Teardown function: removes all CampOS cron jobs
-- ============================================================

CREATE OR REPLACE FUNCTION teardown_cron_jobs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('campos-automation-scheduler');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-automation-scheduler not found, skipping unschedule';
  END;
  BEGIN
    PERFORM cron.unschedule('campos-cleanup-expired-reservations');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-cleanup-expired-reservations not found, skipping unschedule';
  END;
  BEGIN
    PERFORM cron.unschedule('campos-update-housekeeping-status');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-update-housekeeping-status not found, skipping unschedule';
  END;
  RAISE NOTICE 'CampOS cron jobs removed';
END;
$$;

-- ============================================================
-- Lock down permissions (revoke from PUBLIC)
-- ============================================================

REVOKE ALL ON FUNCTION _cron_call_app(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION setup_cron_jobs(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION teardown_cron_jobs() FROM PUBLIC;
REVOKE ALL ON TABLE _cron_config FROM PUBLIC;
