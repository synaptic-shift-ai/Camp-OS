-- Migration: property_role_categories
-- NOTE: Made idempotent for branch creation support
-- Description: Per-property, per-role category labels (e.g. housekeeping, maintenance) with optional access payload
-- Created: 2026-04-08

-- ============================================================================
-- Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.property_role_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL
        CHECK (role IN ('owner', 'manager', 'staff', 'viewer')),
    name TEXT NOT NULL,
    access JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT property_role_categories_property_role_name_key UNIQUE (property_id, role, name)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_property_role_categories_property_id
    ON public.property_role_categories (property_id);

CREATE INDEX IF NOT EXISTS idx_property_role_categories_property_role
    ON public.property_role_categories (property_id, role);

COMMENT ON TABLE public.property_role_categories IS
    'Custom role-scoped category names per property; role aligns with property_staff.role.';
COMMENT ON COLUMN public.property_role_categories.role IS
    'Authorization tier for this category namespace; same values as property_staff.role.';
COMMENT ON COLUMN public.property_role_categories.access IS
    'JSON document for module-specific access flags or permissions for this category.';

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.property_role_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on property_role_categories"
    ON public.property_role_categories;
CREATE POLICY "Service role full access on property_role_categories"
    ON public.property_role_categories
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "property_role_categories_select_authenticated"
    ON public.property_role_categories;
CREATE POLICY "property_role_categories_select_authenticated"
    ON public.property_role_categories
    FOR SELECT
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

DROP POLICY IF EXISTS "property_role_categories_insert_authenticated"
    ON public.property_role_categories;
CREATE POLICY "property_role_categories_insert_authenticated"
    ON public.property_role_categories
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_property_owner(property_id));

DROP POLICY IF EXISTS "property_role_categories_update_authenticated"
    ON public.property_role_categories;
CREATE POLICY "property_role_categories_update_authenticated"
    ON public.property_role_categories
    FOR UPDATE
    TO authenticated
    USING (public.is_property_owner(property_id))
    WITH CHECK (public.is_property_owner(property_id));

DROP POLICY IF EXISTS "property_role_categories_delete_authenticated"
    ON public.property_role_categories;
CREATE POLICY "property_role_categories_delete_authenticated"
    ON public.property_role_categories
    FOR DELETE
    TO authenticated
    USING (public.is_property_owner(property_id));

GRANT SELECT ON public.property_role_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.property_role_categories TO authenticated;
GRANT ALL ON public.property_role_categories TO service_role;

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_property_role_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_property_role_categories_updated_at
    ON public.property_role_categories;
CREATE TRIGGER trigger_update_property_role_categories_updated_at
    BEFORE UPDATE ON public.property_role_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_property_role_categories_updated_at();
