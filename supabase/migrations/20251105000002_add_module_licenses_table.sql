-- Migration: Add Module Licenses Table
-- Description: Tracks which premium modules are licensed for each company
-- Created: 2025-11-05
-- Phase: Phase 0, Week 2 - API Standards & Database Enhancements

-- Create module_licenses table
CREATE TABLE IF NOT EXISTS public.module_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    module_name TEXT NOT NULL, -- e.g., 'DynamicPricing', 'ChannelManagement', 'GuestCommunications'
    is_active BOOLEAN NOT NULL DEFAULT true,
    features JSONB, -- Module-specific feature flags
    expires_at TIMESTAMPTZ, -- NULL for perpetual licenses
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: one license per module per company
    CONSTRAINT module_licenses_company_module_key UNIQUE (company_id, module_name)
);

-- Index for querying active licenses by company
CREATE INDEX IF NOT EXISTS idx_module_licenses_company_active
ON public.module_licenses (company_id, is_active)
WHERE is_active = true;

-- Index for expiring licenses (for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_module_licenses_expires_at
ON public.module_licenses (expires_at)
WHERE expires_at IS NOT NULL AND is_active = true;

-- Add comments
COMMENT ON TABLE public.module_licenses IS 'Tracks premium module licenses for each company';
COMMENT ON COLUMN public.module_licenses.module_name IS 'Name of the licensed module (e.g., DynamicPricing, ChannelManagement)';
COMMENT ON COLUMN public.module_licenses.is_active IS 'Whether the license is currently active';
COMMENT ON COLUMN public.module_licenses.features IS 'JSON object containing module-specific feature flags';
COMMENT ON COLUMN public.module_licenses.expires_at IS 'Expiration date (NULL for perpetual licenses)';

-- Enable Row Level Security
ALTER TABLE public.module_licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role full access
CREATE POLICY "Service role full access on module_licenses"
ON public.module_licenses
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policy: Users can read their company's licenses
CREATE POLICY "Users can read their company licenses"
ON public.module_licenses
FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT p.company_id
        FROM public.properties p
        WHERE p.user_id = auth.uid()
    )
);

-- Grant permissions
GRANT SELECT ON public.module_licenses TO authenticated;
GRANT ALL ON public.module_licenses TO service_role;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_module_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on modification
CREATE TRIGGER trigger_update_module_licenses_updated_at
BEFORE UPDATE ON public.module_licenses
FOR EACH ROW
EXECUTE FUNCTION public.update_module_licenses_updated_at();

-- Insert core module licenses (free for all companies)
-- These will be created when companies are created
-- For now, just set up the structure
