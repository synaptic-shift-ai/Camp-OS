-- Migration: maintenance_phase1_columns
-- Description: Adds WO number, counter table, actual cost columns, vendor closeout,
--              in_progress_vendor status, phone to vendor, is_suspected_damage flag
-- Created: 2026-04-27

-- ============================================================================
-- WO Number: persistent sequential format WO-[PROP]-[YY]-[NNNNN]
-- ============================================================================

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS wo_number VARCHAR(20);

-- NULL-safe unique index — allows NULL but enforces unique non-null values
CREATE UNIQUE INDEX IF NOT EXISTS maintenance_tasks_wo_number_unique
  ON public.maintenance_tasks(wo_number) WHERE wo_number IS NOT NULL;

-- ============================================================================
-- WO Number counter table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maintenance_wo_counter (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  last_number BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.maintenance_wo_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_maintenance_wo_counter"
  ON public.maintenance_wo_counter FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "maintenance_wo_counter_select_authenticated"
  ON public.maintenance_wo_counter FOR SELECT TO authenticated USING (
    property_id IN (SELECT public.get_accessible_property_ids())
  );

CREATE POLICY "maintenance_wo_counter_insert_authenticated"
  ON public.maintenance_wo_counter FOR INSERT TO authenticated WITH CHECK (
    property_id IN (SELECT public.get_accessible_property_ids())
  );

CREATE POLICY "maintenance_wo_counter_update_authenticated"
  ON public.maintenance_wo_counter FOR UPDATE TO authenticated USING (
    property_id IN (SELECT public.get_accessible_property_ids())
  );

-- ============================================================================
-- Add phone to vendor table
-- ============================================================================

ALTER TABLE public.property_vendor
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- ============================================================================
-- Add actual cost columns
-- ============================================================================

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS actual_labor_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actual_parts_cost NUMERIC(12,2);

-- ============================================================================
-- Add is_suspected_damage flag
-- ============================================================================

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS is_suspected_damage BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- Add in_progress_vendor to status check constraint
-- ============================================================================

ALTER TABLE public.maintenance_tasks
  DROP CONSTRAINT IF EXISTS maintenance_tasks_status_check;

ALTER TABLE public.maintenance_tasks
  ADD CONSTRAINT maintenance_tasks_status_check
    CHECK (status IN ('open', 'in_progress', 'in_progress_vendor', 'on_hold', 'completed', 'cancelled'));

-- ============================================================================
-- Vendor closeout columns
-- ============================================================================

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS vendor_invoice_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vendor_invoice_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS closeout_notes TEXT;

-- ============================================================================
-- Backfill existing WOs with sequential numbers
-- ============================================================================

INSERT INTO public.maintenance_wo_counter (property_id, last_number)
SELECT property_id, COUNT(*)
FROM public.maintenance_tasks
GROUP BY property_id
ON CONFLICT (property_id) DO UPDATE SET last_number = EXCLUDED.last_number;

WITH ranked AS (
  SELECT id, property_id,
    ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY created_at, id) AS seq
  FROM public.maintenance_tasks
  WHERE wo_number IS NULL
)
UPDATE public.maintenance_tasks m
SET wo_number = concat(
  UPPER(REPLACE(
    (SELECT LEFT(name, 4) FROM public.properties WHERE id = m.property_id),
    '[^A-Za-z0-9]', ''
  )),
  '-',
  TO_CHAR(m.created_at, 'YY'),
  '-',
  LPAD(r.seq::text, 5, '0')
)
FROM ranked r
WHERE m.id = r.id;
