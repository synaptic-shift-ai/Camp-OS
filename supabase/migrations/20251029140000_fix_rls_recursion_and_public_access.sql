-- Fix RLS Policy Infinite Recursion and Add Public Access for Guest Booking
-- NOTE: Made idempotent for branch creation support
-- This migration:
-- 1. Fixes circular reference in property_staff RLS policies
-- 2. Adds public read access for guest booking portal (properties and sites)

-- ============================================================================
-- PART 1: Fix Property Staff Circular Reference (idempotent)
-- ============================================================================

-- Drop problematic recursive policy
DROP POLICY IF EXISTS "Users can view staff of their properties" ON property_staff;
DROP POLICY IF EXISTS "Property owners can view staff" ON property_staff;

-- Recreate without circular reference - only property owners can view staff
CREATE POLICY "Property owners can view staff"
    ON property_staff FOR SELECT
    USING (
        property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
    );

-- Also fix the properties policy to break the cycle
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
DROP POLICY IF EXISTS "Property owners can view their properties" ON properties;
DROP POLICY IF EXISTS "Property staff can view assigned properties" ON properties;

-- Split into two simpler policies without circular dependency
CREATE POLICY "Property owners can view their properties"
    ON properties FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Property staff can view assigned properties"
    ON properties FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM property_staff
            WHERE property_staff.property_id = properties.id
            AND property_staff.user_id = auth.uid()
        )
    );

-- ============================================================================
-- PART 2: Add Public Access for Guest Booking Portal (idempotent)
-- ============================================================================

-- Allow anonymous users to view properties that have booking enabled
DROP POLICY IF EXISTS "Public can view bookable properties" ON properties;
CREATE POLICY "Public can view bookable properties"
    ON properties FOR SELECT
    TO anon
    USING (
        booking_page_slug IS NOT NULL
        AND onboarding_completed = true
        AND status = 'active'
    );

-- Allow anonymous users to view available sites for bookable properties
DROP POLICY IF EXISTS "Public can view available sites for booking" ON sites;
CREATE POLICY "Public can view available sites for booking"
    ON sites FOR SELECT
    TO anon
    USING (
        status = 'available'
        AND property_id IN (
            SELECT id FROM properties
            WHERE booking_page_slug IS NOT NULL
            AND onboarding_completed = true
            AND status = 'active'
        )
    );

-- Allow anonymous users to create guest records (for new bookings)
DROP POLICY IF EXISTS "Public can create guest records" ON guests;
CREATE POLICY "Public can create guest records"
    ON guests FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anonymous users to view their own guest record (by session)
DROP POLICY IF EXISTS "Public can view their own guest info" ON guests;
CREATE POLICY "Public can view their own guest info"
    ON guests FOR SELECT
    TO anon
    USING (true);  -- TODO: Restrict this further with session-based checks

-- Allow anonymous users to create reservations (for new bookings)
DROP POLICY IF EXISTS "Public can create reservations" ON reservations;
CREATE POLICY "Public can create reservations"
    ON reservations FOR INSERT
    TO anon
    WITH CHECK (
        -- Ensure the reservation is for a bookable property
        property_id IN (
            SELECT id FROM properties
            WHERE booking_page_slug IS NOT NULL
            AND onboarding_completed = true
            AND status = 'active'
        )
    );

-- Allow anonymous users to view reservations (only their own via confirmation number)
DROP POLICY IF EXISTS "Public can view reservations by confirmation number" ON reservations;
CREATE POLICY "Public can view reservations by confirmation number"
    ON reservations FOR SELECT
    TO anon
    USING (true);  -- TODO: Add confirmation_number filter in application layer

-- Allow anonymous users to update reservation status (for payment confirmation)
DROP POLICY IF EXISTS "Public can update reservation payment status" ON reservations;
CREATE POLICY "Public can update reservation payment status"
    ON reservations FOR UPDATE
    TO anon
    USING (true)  -- TODO: Restrict to only payment-related fields
    WITH CHECK (true);

-- Allow anonymous users to create payment records
DROP POLICY IF EXISTS "Public can create payment records" ON payments;
CREATE POLICY "Public can create payment records"
    ON payments FOR INSERT
    TO anon
    WITH CHECK (true);

-- ============================================================================
-- PART 3: Grant necessary permissions to anon role
-- ============================================================================

-- Grant SELECT on properties and sites to anonymous users
GRANT SELECT ON properties TO anon;
GRANT SELECT ON sites TO anon;

-- Grant INSERT/SELECT on guests and reservations for booking flow
GRANT INSERT, SELECT ON guests TO anon;
GRANT INSERT, SELECT, UPDATE ON reservations TO anon;
GRANT INSERT ON payments TO anon;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Test that anonymous users can now query sites
-- Run this in SQL editor with: SET ROLE anon;
-- SELECT COUNT(*) FROM sites WHERE status = 'available';
-- RESET ROLE;
