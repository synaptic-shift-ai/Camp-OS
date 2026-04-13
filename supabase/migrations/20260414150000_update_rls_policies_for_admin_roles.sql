-- Migration: Update RLS policies to include admin and property_admin roles
-- Description:
-- - RLS policies created before the admin/property_admin roles were added only check
--   for role IN ('owner', 'manager') or role IN ('owner', 'manager', 'staff').
-- - This migration updates those policies to include 'admin' and 'property_admin'
--   so that admin-level staff users can access data via RLS.
-- NOTE: Idempotent (uses CREATE OR REPLACE / DROP IF EXISTS)

BEGIN;

-- ============================================================================
-- 1. Properties: owners_managers_update_properties
-- ============================================================================

DROP POLICY IF EXISTS "owners_managers_update_properties" ON properties;

CREATE POLICY "owners_managers_update_properties"
    ON properties FOR UPDATE
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR id IN (
            SELECT property_id
            FROM property_staff
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'property_admin', 'manager')
        )
    );

-- ============================================================================
-- 2. Sites: users_manage_property_sites
-- ============================================================================

DROP POLICY IF EXISTS "users_manage_property_sites" ON sites;

CREATE POLICY "users_manage_property_sites"
    ON sites FOR ALL
    TO authenticated
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'property_admin', 'manager')
        )
    );

-- ============================================================================
-- 3. Reservations: reservation_actions INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Users can create reservation actions for their properties" ON reservation_actions;

CREATE POLICY "Users can create reservation actions for their properties"
  ON reservation_actions FOR INSERT
  WITH CHECK (
    reservation_id IN (
      SELECT id FROM reservations WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()
        UNION
        SELECT property_id FROM property_staff WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'property_admin', 'manager', 'staff')
      )
    )
  );

-- ============================================================================
-- 4. Payment Installments: ALL operations
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage payment installments for their properties" ON payment_installments;

CREATE POLICY "Users can manage payment installments for their properties"
  ON payment_installments FOR ALL
  USING (
    reservation_id IN (
      SELECT id FROM reservations WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()
        UNION
        SELECT property_id FROM property_staff WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'property_admin', 'manager', 'staff')
      )
    )
  );

COMMIT;
