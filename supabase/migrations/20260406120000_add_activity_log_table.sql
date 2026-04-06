-- Migration: Add activity_log table
-- NOTE: Made idempotent for branch creation support
-- Description: Stores staff/admin activity for property auditing UI

CREATE SEQUENCE IF NOT EXISTS public.activity_log_activity_id_seq;

CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL DEFAULT (nextval('public.activity_log_activity_id_seq'::regclass)::text),
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT activity_log_activity_id_key UNIQUE (activity_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_log_company_id
ON public.activity_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_property_id
ON public.activity_log (property_id, created_at DESC)
WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id
ON public.activity_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
ON public.activity_log (created_at DESC);

COMMENT ON TABLE public.activity_log IS 'Staff and admin activity records for auditing';
COMMENT ON COLUMN public.activity_log.activity_id IS 'Monotonic numeric string from activity_log_activity_id_seq (stable row identifier / API)';
COMMENT ON COLUMN public.activity_log.action IS 'What occurred (e.g. created, updated, deleted)';
COMMENT ON COLUMN public.activity_log.resource IS 'What was affected (e.g. entity type or resource key)';
COMMENT ON COLUMN public.activity_log.user_id IS 'Actor id: either auth.users.id or property_staff.id (no FK; disambiguate in application code)';

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on activity_log" ON public.activity_log;
CREATE POLICY "Service role full access on activity_log"
ON public.activity_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Property staff and owners can read activity_log" ON public.activity_log;
CREATE POLICY "Property staff and owners can read activity_log"
ON public.activity_log
FOR SELECT
TO authenticated
USING (
    (
        property_id IS NULL
        AND company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    )
    OR
    property_id IN (
        SELECT p.id FROM public.properties p
        JOIN public.companies c ON p.company_id = c.id
        WHERE c.owner_id = auth.uid()
    )
    OR
    property_id IN (
        SELECT property_id FROM public.property_staff
        WHERE user_id = auth.uid()
    )
);

GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
