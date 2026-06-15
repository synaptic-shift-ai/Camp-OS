-- ============================================================
-- PM work orders cron: every 5 minutes (was daily 06:00 UTC)
-- ============================================================
-- Updates setup_cron_jobs so campos-generate-pm-work-orders runs */5 * * * *.
--
-- After applying, re-register jobs (idempotent):
--   SELECT setup_cron_jobs('https://your-app-url.com', 'your-cron-secret');
-- ============================================================

CREATE OR REPLACE FUNCTION setup_cron_jobs(p_app_url text, p_cron_secret text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
AS $setup$
BEGIN
  -- Store / update config (upsert)
  INSERT INTO _cron_config (key, value) VALUES ('app_url', p_app_url)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO _cron_config (key, value) VALUES ('cron_secret', COALESCE(p_cron_secret, ''))
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
  BEGIN
    PERFORM cron.unschedule('campos-send-scheduled-campaigns');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-send-scheduled-campaigns not found, skipping unschedule';
  END;
  BEGIN
    PERFORM cron.unschedule('campos-generate-pm-work-orders');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-generate-pm-work-orders not found, skipping unschedule';
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

  -- Send Scheduled Message Campaigns — every 5 minutes
  PERFORM cron.schedule(
    'campos-send-scheduled-campaigns',
    '*/5 * * * *',
    $$SELECT _cron_call_app('/api/cron/send-scheduled-campaigns')$$
  );

  -- Generate PM Work Orders — every 5 minutes
  PERFORM cron.schedule(
    'campos-generate-pm-work-orders',
    '*/5 * * * *',
    $$SELECT _cron_call_app('/api/cron/generate-pm-work-orders')$$
  );

  RAISE NOTICE 'CampOS cron jobs registered: 5 jobs active';
END;
$setup$;

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
  BEGIN
    PERFORM cron.unschedule('campos-send-scheduled-campaigns');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-send-scheduled-campaigns not found, skipping unschedule';
  END;
  BEGIN
    PERFORM cron.unschedule('campos-generate-pm-work-orders');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job campos-generate-pm-work-orders not found, skipping unschedule';
  END;
  RAISE NOTICE 'CampOS cron jobs removed';
END;
$$;

REVOKE ALL ON FUNCTION setup_cron_jobs(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION teardown_cron_jobs() FROM PUBLIC;
