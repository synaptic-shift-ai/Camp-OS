-- Migration: Create messaging tables for CC50-02 Campaign & Direct Messaging
-- Description: Campaign management, recipient tracking, and guest messaging preferences
-- Created: 2026-05-21

-- ============================================================================
-- 1. message_campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel TEXT NOT NULL
        CHECK (channel IN ('email', 'sms', 'both')),
    segment_type TEXT,
    audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
    template_id UUID REFERENCES public.sms_templates(id) ON DELETE SET NULL,
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.message_campaigns IS
    'Campaign and direct message management for guest communications (email & SMS).';
COMMENT ON COLUMN public.message_campaigns.channel IS 'Delivery channel: email, sms, or both';
COMMENT ON COLUMN public.message_campaigns.segment_type IS 'Target audience segment (e.g. upcoming, past_guests, all)';
COMMENT ON COLUMN public.message_campaigns.audience_filter IS 'JSON filter criteria used to select recipients';
COMMENT ON COLUMN public.message_campaigns.status IS 'Campaign lifecycle status';

-- ============================================================================
-- 2. message_recipients
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.message_campaigns(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    personalized_subject TEXT,
    personalized_body TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'skipped')),
    provider_message_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.message_recipients IS
    'Per-recipient delivery tracking for message campaigns.';
COMMENT ON COLUMN public.message_recipients.status IS 'Delivery status: pending, queued, sent, delivered, failed, or skipped';
COMMENT ON COLUMN public.message_recipients.provider_message_id IS 'External provider message ID for delivery tracking';
COMMENT ON COLUMN public.message_recipients.personalized_subject IS 'Per-recipient subject override (for personalized campaigns)';
COMMENT ON COLUMN public.message_recipients.personalized_body IS 'Per-recipient body override (for personalized campaigns)';

-- ============================================================================
-- 3. guest_message_preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guest_message_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL UNIQUE REFERENCES public.guests(id) ON DELETE CASCADE,
    email_opt_in BOOLEAN NOT NULL DEFAULT true,
    sms_opt_in BOOLEAN NOT NULL DEFAULT true,
    email_unsubscribed_at TIMESTAMPTZ,
    sms_opted_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.guest_message_preferences IS
    'Per-guest messaging opt-in/opt-out preferences (CAN-SPAM & TCPA compliance).';
COMMENT ON COLUMN public.guest_message_preferences.email_opt_in IS 'Whether the guest has opted in to email communications';
COMMENT ON COLUMN public.guest_message_preferences.sms_opt_in IS 'Whether the guest has opted in to SMS communications';
COMMENT ON COLUMN public.guest_message_preferences.email_unsubscribed_at IS 'Timestamp when the guest unsubscribed from email';
COMMENT ON COLUMN public.guest_message_preferences.sms_opted_out_at IS 'Timestamp when the guest opted out of SMS';

-- ============================================================================
-- Indexes
-- ============================================================================

-- message_campaigns
CREATE INDEX IF NOT EXISTS idx_message_campaigns_property_id
    ON public.message_campaigns (property_id);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_status
    ON public.message_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_scheduled_at
    ON public.message_campaigns (scheduled_at)
    WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_campaigns_created_by
    ON public.message_campaigns (created_by)
    WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_campaigns_company_id
    ON public.message_campaigns (company_id);

-- message_recipients
CREATE INDEX IF NOT EXISTS idx_message_recipients_campaign_id
    ON public.message_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_guest_id
    ON public.message_recipients (guest_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_status
    ON public.message_recipients (status);

-- guest_message_preferences (guest_id already has unique index via UNIQUE constraint)

-- ============================================================================
-- updated_at triggers
-- ============================================================================

-- message_campaigns
CREATE OR REPLACE FUNCTION public.update_message_campaigns_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_message_campaigns_updated_at
    ON public.message_campaigns;
CREATE TRIGGER trigger_update_message_campaigns_updated_at
    BEFORE UPDATE ON public.message_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.update_message_campaigns_updated_at();

-- message_recipients
CREATE OR REPLACE FUNCTION public.update_message_recipients_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_message_recipients_updated_at
    ON public.message_recipients;
CREATE TRIGGER trigger_update_message_recipients_updated_at
    BEFORE UPDATE ON public.message_recipients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_message_recipients_updated_at();

-- guest_message_preferences
CREATE OR REPLACE FUNCTION public.update_guest_message_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_guest_message_preferences_updated_at
    ON public.guest_message_preferences;
CREATE TRIGGER trigger_update_guest_message_preferences_updated_at
    BEFORE UPDATE ON public.guest_message_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_guest_message_preferences_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.message_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_message_preferences ENABLE ROW LEVEL SECURITY;

-- ── message_campaigns ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role full access on message_campaigns"
    ON public.message_campaigns;
CREATE POLICY "Service role full access on message_campaigns"
    ON public.message_campaigns
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "message_campaigns_select_authenticated"
    ON public.message_campaigns;
CREATE POLICY "message_campaigns_select_authenticated"
    ON public.message_campaigns
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

DROP POLICY IF EXISTS "message_campaigns_insert_authenticated"
    ON public.message_campaigns;
CREATE POLICY "message_campaigns_insert_authenticated"
    ON public.message_campaigns
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "message_campaigns_update_authenticated"
    ON public.message_campaigns;
CREATE POLICY "message_campaigns_update_authenticated"
    ON public.message_campaigns
    FOR UPDATE
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "message_campaigns_delete_authenticated"
    ON public.message_campaigns;
CREATE POLICY "message_campaigns_delete_authenticated"
    ON public.message_campaigns
    FOR DELETE
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

-- ── message_recipients ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role full access on message_recipients"
    ON public.message_recipients;
CREATE POLICY "Service role full access on message_recipients"
    ON public.message_recipients
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "message_recipients_select_authenticated"
    ON public.message_recipients;
CREATE POLICY "message_recipients_select_authenticated"
    ON public.message_recipients
    FOR SELECT
    TO authenticated
    USING (
        campaign_id IN (
            SELECT mc.id FROM public.message_campaigns mc
            WHERE mc.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
               OR mc.property_id IN (SELECT public.get_accessible_property_ids())
        )
    );

DROP POLICY IF EXISTS "message_recipients_insert_authenticated"
    ON public.message_recipients;
CREATE POLICY "message_recipients_insert_authenticated"
    ON public.message_recipients
    FOR INSERT
    TO authenticated
    WITH CHECK (
        campaign_id IN (
            SELECT mc.id FROM public.message_campaigns mc
            WHERE mc.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "message_recipients_update_authenticated"
    ON public.message_recipients;
CREATE POLICY "message_recipients_update_authenticated"
    ON public.message_recipients
    FOR UPDATE
    TO authenticated
    USING (
        campaign_id IN (
            SELECT mc.id FROM public.message_campaigns mc
            WHERE mc.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        )
    )
    WITH CHECK (
        campaign_id IN (
            SELECT mc.id FROM public.message_campaigns mc
            WHERE mc.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "message_recipients_delete_authenticated"
    ON public.message_recipients;
CREATE POLICY "message_recipients_delete_authenticated"
    ON public.message_recipients
    FOR DELETE
    TO authenticated
    USING (
        campaign_id IN (
            SELECT mc.id FROM public.message_campaigns mc
            WHERE mc.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        )
    );

-- ── guest_message_preferences ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role full access on guest_message_preferences"
    ON public.guest_message_preferences;
CREATE POLICY "Service role full access on guest_message_preferences"
    ON public.guest_message_preferences
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "guest_message_preferences_select_authenticated"
    ON public.guest_message_preferences;
CREATE POLICY "guest_message_preferences_select_authenticated"
    ON public.guest_message_preferences
    FOR SELECT
    TO authenticated
    USING (
        guest_id IN (
            SELECT g.id FROM public.guests g
            WHERE g.property_id IS NOT NULL
              AND g.property_id IN (SELECT public.get_accessible_property_ids())
        )
    );

DROP POLICY IF EXISTS "guest_message_preferences_insert_authenticated"
    ON public.guest_message_preferences;
CREATE POLICY "guest_message_preferences_insert_authenticated"
    ON public.guest_message_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (
        guest_id IN (
            SELECT g.id FROM public.guests g
            WHERE g.property_id IS NOT NULL
              AND g.property_id IN (SELECT public.get_accessible_property_ids())
        )
    );

DROP POLICY IF EXISTS "guest_message_preferences_update_authenticated"
    ON public.guest_message_preferences;
CREATE POLICY "guest_message_preferences_update_authenticated"
    ON public.guest_message_preferences
    FOR UPDATE
    TO authenticated
    USING (
        guest_id IN (
            SELECT g.id FROM public.guests g
            WHERE g.property_id IS NOT NULL
              AND g.property_id IN (SELECT public.get_accessible_property_ids())
        )
    )
    WITH CHECK (
        guest_id IN (
            SELECT g.id FROM public.guests g
            WHERE g.property_id IS NOT NULL
              AND g.property_id IN (SELECT public.get_accessible_property_ids())
        )
    );

-- No DELETE policy for authenticated — preferences should not be hard-deleted by users

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.message_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_campaigns TO authenticated;

GRANT ALL ON public.message_recipients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_recipients TO authenticated;

GRANT ALL ON public.guest_message_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.guest_message_preferences TO authenticated;
