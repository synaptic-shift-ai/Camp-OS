-- Migration: Add communication tables for CC50-01 Guest Communications
-- NOTE: Made idempotent for branch creation support
-- Description: Append-only delivery audit trail, per-property email branding, and CAN-SPAM/TCPA opt-out registry
-- Created: 2026-05-12

-- ============================================================================
-- 1. communication_log (append-only delivery audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.communication_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'email'
        CHECK (channel IN ('email', 'sms')),
    recipient_address TEXT NOT NULL,
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'failed', 'skipped')),
    bounce_type TEXT
        CHECK (bounce_type IN ('hard', 'soft')),
    failure_reason TEXT,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_communication_log_property_id
    ON public.communication_log (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_log_reservation_id
    ON public.communication_log (reservation_id)
    WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_log_guest_id
    ON public.communication_log (guest_id)
    WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_log_status
    ON public.communication_log (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_log_created_at
    ON public.communication_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_log_company_id
    ON public.communication_log (company_id, created_at DESC);

COMMENT ON TABLE public.communication_log IS
    'Append-only delivery audit trail for all guest communications (email & SMS).';
COMMENT ON COLUMN public.communication_log.channel IS 'Delivery channel: email or sms';
COMMENT ON COLUMN public.communication_log.status IS 'Delivery status: queued, sent, delivered, bounced, failed, or skipped';
COMMENT ON COLUMN public.communication_log.bounce_type IS 'Bounce classification (hard/soft), only set when status=bounced';
COMMENT ON COLUMN public.communication_log.retry_count IS 'Number of delivery retry attempts';

-- ============================================================================
-- 2. communication_branding (per-property email branding)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.communication_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
    logo_url TEXT,
    sender_name TEXT NOT NULL DEFAULT 'CampOS',
    sender_email TEXT,
    reply_to_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.communication_branding IS
    'Per-property email branding configuration (sender name, logo, reply-to).';
COMMENT ON COLUMN public.communication_branding.sender_name IS 'Display name used as the From: sender for emails';
COMMENT ON COLUMN public.communication_branding.sender_email IS 'Custom From: email address (must be verified in ESP)';
COMMENT ON COLUMN public.communication_branding.reply_to_email IS 'Reply-To email address for guest replies';

-- ============================================================================
-- 3. communication_opt_outs (CAN-SPAM/TCPA registry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.communication_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    channel TEXT NOT NULL
        CHECK (channel IN ('email', 'sms')),
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL
        CHECK (source IN ('unsubscribe_link', 'sms_stop', 'manual')),
    UNIQUE (company_id, guest_id, channel)
);

COMMENT ON TABLE public.communication_opt_outs IS
    'CAN-SPAM and TCPA opt-out registry. Prevents sending to guests who have unsubscribed.';
COMMENT ON COLUMN public.communication_opt_outs.source IS 'How the opt-out was recorded: unsubscribe_link, sms_stop, or manual';

-- ============================================================================
-- updated_at trigger for communication_branding
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_communication_branding_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_communication_branding_updated_at
    ON public.communication_branding;
CREATE TRIGGER trigger_update_communication_branding_updated_at
    BEFORE UPDATE ON public.communication_branding
    FOR EACH ROW
    EXECUTE FUNCTION public.update_communication_branding_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_opt_outs ENABLE ROW LEVEL SECURITY;

-- ── communication_log ──────────────────────────────────────────────────────
-- Service role: full access (writes are service-only)

DROP POLICY IF EXISTS "Service role full access on communication_log"
    ON public.communication_log;
CREATE POLICY "Service role full access on communication_log"
    ON public.communication_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated: SELECT only (read-only audit trail)

DROP POLICY IF EXISTS "communication_log_select_authenticated"
    ON public.communication_log;
CREATE POLICY "communication_log_select_authenticated"
    ON public.communication_log
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

-- ── communication_branding ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role full access on communication_branding"
    ON public.communication_branding;
CREATE POLICY "Service role full access on communication_branding"
    ON public.communication_branding
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "communication_branding_select_authenticated"
    ON public.communication_branding;
CREATE POLICY "communication_branding_select_authenticated"
    ON public.communication_branding
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

DROP POLICY IF EXISTS "communication_branding_insert_authenticated"
    ON public.communication_branding;
CREATE POLICY "communication_branding_insert_authenticated"
    ON public.communication_branding
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "communication_branding_update_authenticated"
    ON public.communication_branding;
CREATE POLICY "communication_branding_update_authenticated"
    ON public.communication_branding
    FOR UPDATE
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

-- ── communication_opt_outs ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role full access on communication_opt_outs"
    ON public.communication_opt_outs;
CREATE POLICY "Service role full access on communication_opt_outs"
    ON public.communication_opt_outs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated: SELECT and INSERT only (no UPDATE/DELETE — immutable audit record)

DROP POLICY IF EXISTS "communication_opt_outs_select_authenticated"
    ON public.communication_opt_outs;
CREATE POLICY "communication_opt_outs_select_authenticated"
    ON public.communication_opt_outs
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        OR guest_id IN (
            SELECT g.id FROM public.guests g
            JOIN public.companies c ON g.company_id = c.id
            WHERE c.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "communication_opt_outs_insert_authenticated"
    ON public.communication_opt_outs;
CREATE POLICY "communication_opt_outs_insert_authenticated"
    ON public.communication_opt_outs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.communication_log TO service_role;
GRANT SELECT ON public.communication_log TO authenticated;

GRANT ALL ON public.communication_branding TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.communication_branding TO authenticated;

GRANT ALL ON public.communication_opt_outs TO service_role;
GRANT SELECT, INSERT ON public.communication_opt_outs TO authenticated;
