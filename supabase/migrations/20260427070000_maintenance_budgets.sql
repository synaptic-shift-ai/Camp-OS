-- Migration: maintenance_budgets
-- Description: Adds maintenance_budgets and maintenance_spend_limits tables
-- Created: 2026-04-27

-- ============================================================================
-- Budgets table
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category VARCHAR(120) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('monthly', 'quarterly', 'annual')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, category, period)
);

-- ============================================================================
-- Spend limits table
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_spend_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category VARCHAR(120) NOT NULL,
  threshold_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  alert_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, category)
);

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE maintenance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_spend_limits ENABLE ROW LEVEL SECURITY;

-- Budgets RLS policies
CREATE POLICY "service_role_full_access_maintenance_budgets" ON maintenance_budgets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_select_maintenance_budgets" ON maintenance_budgets FOR SELECT TO authenticated USING (property_id IN (SELECT get_accessible_property_ids(auth.uid())));
CREATE POLICY "authenticated_insert_maintenance_budgets" ON maintenance_budgets FOR INSERT TO authenticated WITH CHECK (property_id IN (SELECT get_accessible_property_ids(auth.uid())));
CREATE POLICY "authenticated_update_maintenance_budgets" ON maintenance_budgets FOR UPDATE TO authenticated USING (property_id IN (SELECT get_accessible_property_ids(auth.uid())));
CREATE POLICY "authenticated_delete_maintenance_budgets" ON maintenance_budgets FOR DELETE TO authenticated USING (property_id IN (SELECT get_accessible_property_ids(auth.uid())));

-- Spend limits RLS policies
CREATE POLICY "service_role_full_access_maintenance_spend_limits" ON maintenance_spend_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_select_maintenance_spend_limits" ON maintenance_spend_limits FOR SELECT TO authenticated USING (property_id IN (SELECT get_accessible_property_ids(auth.uid())));
CREATE POLICY "authenticated_insert_maintenance_spend_limits" ON maintenance_spend_limits FOR INSERT TO authenticated WITH CHECK (property_id IN (SELECT get_accessible_property_ids(auth.uid())));
CREATE POLICY "authenticated_update_maintenance_spend_limits" ON maintenance_spend_limits FOR UPDATE TO authenticated USING (property_id IN (SELECT get_accessible_property_ids(auth.uid())));
CREATE POLICY "authenticated_delete_maintenance_spend_limits" ON maintenance_spend_limits FOR DELETE TO authenticated USING (property_id IN (SELECT get_accessible_property_ids(auth.uid())));
