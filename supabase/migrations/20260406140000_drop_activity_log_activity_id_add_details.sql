-- Remove activity_id (and its sequence); add optional details for audit UI copy.

ALTER TABLE public.activity_log
    DROP CONSTRAINT IF EXISTS activity_log_activity_id_key;

ALTER TABLE public.activity_log
    DROP COLUMN IF EXISTS activity_id;

DROP SEQUENCE IF EXISTS public.activity_log_activity_id_seq;

ALTER TABLE public.activity_log
    ADD COLUMN IF NOT EXISTS details TEXT;

COMMENT ON COLUMN public.activity_log.details IS 'Optional human-readable summary for the auditing UI';
