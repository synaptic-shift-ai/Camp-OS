-- Migration: Replace is_active with status (draft/active) on email templates
-- Description: Add status TEXT column, backfill from is_active, drop is_active
-- Created: 2026-05-11

BEGIN;

-- ============================================================================
-- A. email_templates: add status, backfill, drop is_active
-- ============================================================================

-- Add status column
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('draft', 'active'))
    DEFAULT 'active';

-- Backfill from is_active (guarded so re-runs don't fail after column is dropped)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
      AND column_name = 'is_active'
  ) THEN
    UPDATE public.email_templates
      SET status = CASE
        WHEN is_active = true THEN 'active'
        WHEN is_active = false THEN 'draft'
        ELSE 'active'
      END
      WHERE status IS NULL;
  END IF;
END $$;

-- Make status NOT NULL after backfill
ALTER TABLE public.email_templates
  ALTER COLUMN status SET NOT NULL;

-- Drop is_active column
ALTER TABLE public.email_templates
  DROP COLUMN IF EXISTS is_active;

-- ============================================================================
-- B. default_email_templates: add status, backfill, drop is_active
-- ============================================================================

-- Add status column
ALTER TABLE public.default_email_templates
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('draft', 'active'))
    DEFAULT 'active';

-- Backfill from is_active (guarded so re-runs don't fail after column is dropped)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'default_email_templates'
      AND column_name = 'is_active'
  ) THEN
    UPDATE public.default_email_templates
      SET status = CASE
        WHEN is_active = true THEN 'active'
        WHEN is_active = false THEN 'draft'
        ELSE 'active'
      END
      WHERE status IS NULL;
  END IF;
END $$;

-- Make status NOT NULL after backfill
ALTER TABLE public.default_email_templates
  ALTER COLUMN status SET NOT NULL;

-- Drop is_active column
ALTER TABLE public.default_email_templates
  DROP COLUMN IF EXISTS is_active;

COMMIT;
