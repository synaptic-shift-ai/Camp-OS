-- Migration: Create sms_templates table
-- Description: SMS message templates with merge fields for automation COMMUNICATE phase
-- Created: 2026-05-15

-- ============================================================================
-- 1. sms_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    body TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'custom',
    is_system_default BOOLEAN NOT NULL DEFAULT false,
    is_modified BOOLEAN DEFAULT false,
    default_version INTEGER,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_templates_company_property_slug
    ON public.sms_templates (company_id, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'), slug);

CREATE INDEX IF NOT EXISTS idx_sms_templates_company_slug
    ON public.sms_templates (company_id, slug);

CREATE INDEX IF NOT EXISTS idx_sms_templates_property
    ON public.sms_templates (property_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_sms_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_sms_templates_updated_at
    ON public.sms_templates;
CREATE TRIGGER trigger_update_sms_templates_updated_at
    BEFORE UPDATE ON public.sms_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sms_templates_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.sms_templates IS
    'SMS message templates with {{variable}} merge fields for automation COMMUNICATE phase.';

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on sms_templates"
    ON public.sms_templates;
CREATE POLICY "Service role full access on sms_templates"
    ON public.sms_templates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "sms_templates_select_authenticated"
    ON public.sms_templates;
CREATE POLICY "sms_templates_select_authenticated"
    ON public.sms_templates
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

DROP POLICY IF EXISTS "sms_templates_insert_authenticated"
    ON public.sms_templates;
CREATE POLICY "sms_templates_insert_authenticated"
    ON public.sms_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "sms_templates_update_authenticated"
    ON public.sms_templates;
CREATE POLICY "sms_templates_update_authenticated"
    ON public.sms_templates
    FOR UPDATE
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "sms_templates_delete_authenticated"
    ON public.sms_templates;
CREATE POLICY "sms_templates_delete_authenticated"
    ON public.sms_templates
    FOR DELETE
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.sms_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
