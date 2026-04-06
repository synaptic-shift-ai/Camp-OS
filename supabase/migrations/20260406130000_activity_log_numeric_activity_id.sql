-- activity_log.activity_id: use sequence-based numeric string (replaces uuid::text default on existing DBs)

CREATE SEQUENCE IF NOT EXISTS public.activity_log_activity_id_seq;

-- Sequences disallow setval(..., 0). When there are no all-numeric activity_id rows, use setval(1, false) so the next insert gets "1".
WITH bounds AS (
    SELECT COALESCE(
        (
            SELECT MAX((al.activity_id)::bigint)
            FROM public.activity_log al
            WHERE al.activity_id ~ '^[0-9]+$'
        ),
        0::bigint
    ) AS max_num
)
SELECT setval(
    'public.activity_log_activity_id_seq',
    CASE WHEN bounds.max_num = 0 THEN 1 ELSE bounds.max_num END,
    CASE WHEN bounds.max_num = 0 THEN false ELSE true END
)
FROM bounds;

ALTER TABLE public.activity_log
    ALTER COLUMN activity_id SET DEFAULT nextval('public.activity_log_activity_id_seq'::regclass)::text;

COMMENT ON COLUMN public.activity_log.activity_id IS 'Monotonic numeric string from activity_log_activity_id_seq (stable row identifier / API)';
