-- Migration: create_task_images_table
-- Description: Adds shared task image attachments table for housekeeping and maintenance tasks
-- Created: 2026-04-21

CREATE TABLE IF NOT EXISTS public.task_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    task_type VARCHAR(32) NOT NULL
        CHECK (task_type IN ('housekeeping', 'maintenance')),
    task_id UUID NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_images_task_unique_path
    ON public.task_images (task_type, task_id, storage_path);

CREATE INDEX IF NOT EXISTS idx_task_images_property_task
    ON public.task_images (property_id, task_type, task_id);

CREATE INDEX IF NOT EXISTS idx_task_images_property_created_at
    ON public.task_images (property_id, created_at DESC);

COMMENT ON TABLE public.task_images IS
    'Image attachments for property-scoped operational tasks (housekeeping and maintenance).';

COMMENT ON COLUMN public.task_images.task_type IS
    'Task module discriminator: housekeeping or maintenance.';

COMMENT ON COLUMN public.task_images.task_id IS
    'Task identifier from the table indicated by task_type.';

COMMENT ON COLUMN public.task_images.storage_path IS
    'Canonical object path/key inside storage bucket.';

ALTER TABLE public.task_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on task_images"
    ON public.task_images;
CREATE POLICY "Service role full access on task_images"
    ON public.task_images
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "task_images_select_authenticated"
    ON public.task_images;
CREATE POLICY "task_images_select_authenticated"
    ON public.task_images
    FOR SELECT
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

DROP POLICY IF EXISTS "task_images_insert_authenticated"
    ON public.task_images;
CREATE POLICY "task_images_insert_authenticated"
    ON public.task_images
    FOR INSERT
    TO authenticated
    WITH CHECK (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    );

DROP POLICY IF EXISTS "task_images_update_authenticated"
    ON public.task_images;
CREATE POLICY "task_images_update_authenticated"
    ON public.task_images
    FOR UPDATE
    TO authenticated
    USING (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    )
    WITH CHECK (
        property_id IN (SELECT public.get_accessible_property_ids())
        AND (public.is_property_owner(property_id) OR public.is_property_staff(property_id))
    );

DROP POLICY IF EXISTS "task_images_delete_authenticated"
    ON public.task_images;
CREATE POLICY "task_images_delete_authenticated"
    ON public.task_images
    FOR DELETE
    TO authenticated
    USING (public.is_property_owner(property_id) OR public.is_property_staff(property_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_images TO authenticated;
GRANT ALL ON public.task_images TO service_role;

CREATE OR REPLACE FUNCTION public.update_task_images_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_task_images_updated_at
    ON public.task_images;
CREATE TRIGGER trigger_update_task_images_updated_at
    BEFORE UPDATE ON public.task_images
    FOR EACH ROW
    EXECUTE FUNCTION public.update_task_images_updated_at();
