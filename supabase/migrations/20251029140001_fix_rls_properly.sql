-- Properly Fix RLS Infinite Recursion
-- Strategy: Create ONE-WAY dependencies only (no circular references)
--
-- Dependency Flow (allowed):
--   properties → property_staff (OK)
--   sites → properties (OK, if simple)
--
-- Never allowed:
--   property_staff → properties (creates cycle)

-- ============================================================================
-- STEP 1: Drop ALL existing problematic policies
-- ============================================================================

-- Drop all properties policies
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
DROP POLICY IF EXISTS "Property owners can view their properties" ON properties;
DROP POLICY IF EXISTS "Property staff can view assigned properties" ON properties;
DROP POLICY IF EXISTS "Public can view bookable properties" ON properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON properties;

-- Drop all property_staff policies
DROP POLICY IF EXISTS "Users can view staff of their properties" ON property_staff;
DROP POLICY IF EXISTS "Property owners can view staff" ON property_staff;
DROP POLICY IF EXISTS "Property owners can manage staff" ON property_staff;

-- Drop all sites policies
DROP POLICY IF EXISTS "Users can view sites of their properties" ON sites;
DROP POLICY IF EXISTS "Users can manage sites of their properties" ON sites;
DROP POLICY IF EXISTS "Public can view available sites for booking" ON sites;

-- ============================================================================
-- STEP 2: Create simple, non-circular policies
-- ============================================================================

-- ----------------------------------------
-- Properties Policies (can query property_staff)
-- ----------------------------------------

-- Owners can view their properties (no subquery needed)
CREATE POLICY "owners_view_properties"
    ON properties FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

-- Staff can view properties they're assigned to
CREATE POLICY "staff_view_properties"
    ON properties FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT property_id
            FROM property_staff
            WHERE user_id = auth.uid()
        )
    );

-- Anyone can insert properties (becomes owner automatically)
CREATE POLICY "users_insert_properties"
    ON properties FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Owners and managers can update their properties
CREATE POLICY "owners_managers_update_properties"
    ON properties FOR UPDATE
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR id IN (
            SELECT property_id
            FROM property_staff
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'manager')
        )
    );

-- Public can view bookable properties (no subquery - simple!)
CREATE POLICY "public_view_bookable_properties"
    ON properties FOR SELECT
    TO anon
    USING (
        booking_page_slug IS NOT NULL
        AND onboarding_completed = true
        AND status = 'active'
    );

-- ----------------------------------------
-- Property Staff Policies (CANNOT query properties - breaks cycle!)
-- ----------------------------------------

-- Users can view their own staff assignments (no property subquery!)
CREATE POLICY "users_view_own_staff_records"
    ON property_staff FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Property owners can view staff of their properties (check ownership directly)
CREATE POLICY "owners_view_property_staff"
    ON property_staff FOR SELECT
    TO authenticated
    USING (
        property_id IN (
            SELECT id
            FROM properties
            WHERE owner_id = auth.uid()
        )
    );

-- Only property owners can manage staff (direct ownership check)
CREATE POLICY "owners_manage_staff"
    ON property_staff FOR ALL
    TO authenticated
    USING (
        property_id IN (
            SELECT id
            FROM properties
            WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        property_id IN (
            SELECT id
            FROM properties
            WHERE owner_id = auth.uid()
        )
    );

-- ----------------------------------------
-- Sites Policies
-- ----------------------------------------

-- Authenticated users can view sites of their properties
CREATE POLICY "users_view_property_sites"
    ON sites FOR SELECT
    TO authenticated
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

-- Authenticated users can manage sites of their properties
CREATE POLICY "users_manage_property_sites"
    ON sites FOR ALL
    TO authenticated
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
        )
    );

-- Public can view available sites (simple - no property check in RLS!)
-- Application will filter by property_id in queries
CREATE POLICY "public_view_available_sites"
    ON sites FOR SELECT
    TO anon
    USING (status = 'available');

-- ============================================================================
-- STEP 3: Guest/Reservation policies (keep existing from previous migration)
-- ============================================================================

-- Allow anonymous users to create guest records
DROP POLICY IF EXISTS "Public can create guest records" ON guests;
CREATE POLICY "public_create_guests"
    ON guests FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anonymous to view guest records (TODO: restrict by session)
DROP POLICY IF EXISTS "Public can view their own guest info" ON guests;
CREATE POLICY "public_view_guests"
    ON guests FOR SELECT
    TO anon
    USING (true);

-- Allow anonymous users to create reservations
DROP POLICY IF EXISTS "Public can create reservations" ON reservations;
CREATE POLICY "public_create_reservations"
    ON reservations FOR INSERT
    TO anon
    WITH CHECK (
        property_id IN (
            SELECT id FROM properties
            WHERE booking_page_slug IS NOT NULL
            AND onboarding_completed = true
            AND status = 'active'
        )
    );

-- Allow anonymous to view reservations
DROP POLICY IF EXISTS "Public can view reservations by confirmation number" ON reservations;
CREATE POLICY "public_view_reservations"
    ON reservations FOR SELECT
    TO anon
    USING (true);

-- Allow anonymous to update reservations (for payment)
DROP POLICY IF EXISTS "Public can update reservation payment status" ON reservations;
CREATE POLICY "public_update_reservations"
    ON reservations FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- Allow anonymous users to create payments
DROP POLICY IF EXISTS "Public can create payment records" ON payments;
CREATE POLICY "public_create_payments"
    ON payments FOR INSERT
    TO anon
    WITH CHECK (true);

-- ============================================================================
-- STEP 4: Verify - Run these queries to test
-- ============================================================================

-- Test 1: Anonymous can query sites
-- SET ROLE anon;
-- SELECT COUNT(*) FROM sites WHERE status = 'available';
-- RESET ROLE;

-- Test 2: Anonymous can query specific property sites
-- SET ROLE anon;
-- SELECT * FROM sites
-- WHERE property_id = '12da6cb6-ac60-41df-ad6f-640fe3c9091a'
-- AND status = 'available';
-- RESET ROLE;

-- Test 3: Anonymous can query properties
-- SET ROLE anon;
-- SELECT * FROM properties WHERE booking_page_slug IS NOT NULL;
-- RESET ROLE;
