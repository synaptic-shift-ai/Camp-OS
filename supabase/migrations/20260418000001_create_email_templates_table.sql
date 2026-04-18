-- Migration: Create email_templates table
-- Description: HTML email templates with merge fields for automation COMMUNICATE phase
-- Created: 2026-04-18

-- ============================================================================
-- 1. email_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    subject_template TEXT NOT NULL DEFAULT '',
    html_template TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'custom'
        CHECK (category IN ('welcome', 'reservation', 'payment', 'review', 'notification', 'custom')),
    is_system_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- UNIQUE: same slug allowed at company-level AND property-level via COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_company_property_slug
    ON public.email_templates (company_id, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'), slug);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_company_slug
    ON public.email_templates (company_id, slug);

CREATE INDEX IF NOT EXISTS idx_email_templates_property
    ON public.email_templates (property_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_email_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_email_templates_updated_at
    ON public.email_templates;
CREATE TRIGGER trigger_update_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_email_templates_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.email_templates IS
    'HTML email templates with {{variable}} merge fields for automation COMMUNICATE phase.';

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Service role
DROP POLICY IF EXISTS "Service role full access on email_templates"
    ON public.email_templates;
CREATE POLICY "Service role full access on email_templates"
    ON public.email_templates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- SELECT: owner or staff of company's properties
DROP POLICY IF EXISTS "email_templates_select_authenticated"
    ON public.email_templates;
CREATE POLICY "email_templates_select_authenticated"
    ON public.email_templates
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

-- INSERT: company owner only
DROP POLICY IF EXISTS "email_templates_insert_authenticated"
    ON public.email_templates;
CREATE POLICY "email_templates_insert_authenticated"
    ON public.email_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

-- UPDATE: company owner only
DROP POLICY IF EXISTS "email_templates_update_authenticated"
    ON public.email_templates;
CREATE POLICY "email_templates_update_authenticated"
    ON public.email_templates
    FOR UPDATE
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

-- DELETE: company owner only
DROP POLICY IF EXISTS "email_templates_delete_authenticated"
    ON public.email_templates;
CREATE POLICY "email_templates_delete_authenticated"
    ON public.email_templates
    FOR DELETE
    TO authenticated
    USING (
        company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    );

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.email_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
