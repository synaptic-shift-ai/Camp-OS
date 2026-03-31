-- Migration: property_booking_slug_aliases
-- NOTE: Made idempotent for branch creation support
-- Description: Stores historical booking page slugs so old /book/{slug} URLs can redirect after rename.
-- Created: 2026-03-31

-- ============================================================================
-- Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.property_booking_slug_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
    booking_page_slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT property_booking_slug_aliases_booking_page_slug_key UNIQUE (booking_page_slug)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_property_booking_slug_aliases_property_id
    ON public.property_booking_slug_aliases (property_id);

COMMENT ON TABLE public.property_booking_slug_aliases IS
    'Historical booking_page_slug values; used to redirect guests from old URLs after property rename.';
COMMENT ON COLUMN public.property_booking_slug_aliases.booking_page_slug IS
    'Former booking_page_slug value (unique across all properties).';

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.property_booking_slug_aliases ENABLE ROW LEVEL SECURITY;

-- Service role (API / migrations)
DROP POLICY IF EXISTS "Service role full access on property_booking_slug_aliases"
    ON public.property_booking_slug_aliases;
CREATE POLICY "Service role full access on property_booking_slug_aliases"
    ON public.property_booking_slug_aliases
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Anonymous: resolve old slug for published properties (guest redirect lookup)
DROP POLICY IF EXISTS "Public read booking slug aliases for published properties"
    ON public.property_booking_slug_aliases;
CREATE POLICY "Public read booking slug aliases for published properties"
    ON public.property_booking_slug_aliases
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1
            FROM public.properties p
            WHERE p.id = property_booking_slug_aliases.property_id
              AND p.onboarding_completed = true
        )
    );

-- Property owners: manage aliases for their properties
DROP POLICY IF EXISTS "Owners manage booking slug aliases for own properties"
    ON public.property_booking_slug_aliases;
CREATE POLICY "Owners manage booking slug aliases for own properties"
    ON public.property_booking_slug_aliases
    FOR ALL
    TO authenticated
    USING (
        property_id IN (
            SELECT id FROM public.properties WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        property_id IN (
            SELECT id FROM public.properties WHERE owner_id = auth.uid()
        )
    );

GRANT SELECT ON public.property_booking_slug_aliases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_booking_slug_aliases TO authenticated;
GRANT ALL ON public.property_booking_slug_aliases TO service_role;
