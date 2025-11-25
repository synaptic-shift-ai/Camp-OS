-- Final Fix for RLS Infinite Recursion using SECURITY DEFINER Functions
-- NOTE: Made idempotent for branch creation support (uses CREATE OR REPLACE, DROP POLICY IF EXISTS)
-- (Using public schema instead of auth schema)
--
-- Problem: Circular dependency between properties and property_staff RLS policies
-- Solution: Use SECURITY DEFINER functions in public schema that bypass RLS

-- ============================================================================
-- STEP 1: Create helper functions in PUBLIC schema that bypass RLS
-- ============================================================================

-- Function to check if current user owns a property (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_property_owner(prop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.properties
        WHERE id = prop_id
        AND owner_id = auth.uid()
    );
END;
$$;

-- Function to check if current user is staff for a property (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_property_staff(prop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.property_staff
        WHERE property_id = prop_id
        AND user_id = auth.uid()
    );
END;
$$;

-- Function to get all property IDs the user can access (owner or staff)
CREATE OR REPLACE FUNCTION public.get_accessible_property_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT id FROM public.properties WHERE owner_id = auth.uid()
    UNION
    SELECT property_id FROM public.property_staff WHERE user_id = auth.uid();
END;
$$;

-- ============================================================================
-- STEP 2: Drop ALL existing policies
-- ============================================================================

-- Properties
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
DROP POLICY IF EXISTS "Property owners can view their properties" ON properties;
DROP POLICY IF EXISTS "Property staff can view assigned properties" ON properties;
DROP POLICY IF EXISTS "Public can view bookable properties" ON properties;
DROP POLICY IF EXISTS "public_view_bookable_properties" ON properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON properties;
DROP POLICY IF EXISTS "users_insert_properties" ON properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON properties;
DROP POLICY IF EXISTS "owners_managers_update_properties" ON properties;
DROP POLICY IF EXISTS "owners_view_properties" ON properties;
DROP POLICY IF EXISTS "staff_view_properties" ON properties;
DROP POLICY IF EXISTS "properties_select_authenticated" ON properties;
DROP POLICY IF EXISTS "properties_insert_authenticated" ON properties;
DROP POLICY IF EXISTS "properties_update_authenticated" ON properties;
DROP POLICY IF EXISTS "properties_select_anon" ON properties;

-- Property Staff
DROP POLICY IF EXISTS "Users can view staff of their properties" ON property_staff;
DROP POLICY IF EXISTS "Property owners can view staff" ON property_staff;
DROP POLICY IF EXISTS "users_view_own_staff_records" ON property_staff;
DROP POLICY IF EXISTS "owners_view_property_staff" ON property_staff;
DROP POLICY IF EXISTS "Property owners can manage staff" ON property_staff;
DROP POLICY IF EXISTS "owners_manage_staff" ON property_staff;
DROP POLICY IF EXISTS "property_staff_select" ON property_staff;
DROP POLICY IF EXISTS "property_staff_insert" ON property_staff;
DROP POLICY IF EXISTS "property_staff_update" ON property_staff;
DROP POLICY IF EXISTS "property_staff_delete" ON property_staff;

-- Sites
DROP POLICY IF EXISTS "Users can view sites of their properties" ON sites;
DROP POLICY IF EXISTS "users_view_property_sites" ON sites;
DROP POLICY IF EXISTS "Users can manage sites of their properties" ON sites;
DROP POLICY IF EXISTS "users_manage_property_sites" ON sites;
DROP POLICY IF EXISTS "Public can view available sites for booking" ON sites;
DROP POLICY IF EXISTS "public_view_available_sites" ON sites;
DROP POLICY IF EXISTS "sites_select_authenticated" ON sites;
DROP POLICY IF EXISTS "sites_insert_authenticated" ON sites;
DROP POLICY IF EXISTS "sites_update_authenticated" ON sites;
DROP POLICY IF EXISTS "sites_delete_authenticated" ON sites;
DROP POLICY IF EXISTS "sites_select_anon" ON sites;

-- Guests
DROP POLICY IF EXISTS "Users can view guests of their properties" ON guests;
DROP POLICY IF EXISTS "Users can manage guests of their properties" ON guests;
DROP POLICY IF EXISTS "public_create_guests" ON guests;
DROP POLICY IF EXISTS "public_view_guests" ON guests;
DROP POLICY IF EXISTS "guests_authenticated" ON guests;
DROP POLICY IF EXISTS "guests_anon_insert" ON guests;
DROP POLICY IF EXISTS "guests_anon_select" ON guests;

-- Reservations
DROP POLICY IF EXISTS "Users can view reservations of their properties" ON reservations;
DROP POLICY IF EXISTS "Users can manage reservations of their properties" ON reservations;
DROP POLICY IF EXISTS "public_create_reservations" ON reservations;
DROP POLICY IF EXISTS "public_view_reservations" ON reservations;
DROP POLICY IF EXISTS "public_update_reservations" ON reservations;
DROP POLICY IF EXISTS "reservations_authenticated" ON reservations;
DROP POLICY IF EXISTS "reservations_anon_insert" ON reservations;
DROP POLICY IF EXISTS "reservations_anon_select" ON reservations;
DROP POLICY IF EXISTS "reservations_anon_update" ON reservations;

-- Payments
DROP POLICY IF EXISTS "Users can view payments of their properties" ON payments;
DROP POLICY IF EXISTS "Users can manage payments of their properties" ON payments;
DROP POLICY IF EXISTS "public_create_payments" ON payments;
DROP POLICY IF EXISTS "payments_authenticated" ON payments;
DROP POLICY IF EXISTS "payments_anon_insert" ON payments;

-- ============================================================================
-- STEP 3: Create new policies using helper functions (NO CIRCULAR REFERENCES!)
-- ============================================================================

-- ----------------------------------------
-- Properties (using public.is_property_staff)
-- ----------------------------------------

CREATE POLICY "properties_select_authenticated"
    ON properties FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR public.is_property_staff(id)  -- Uses function, bypasses RLS
    );

CREATE POLICY "properties_insert_authenticated"
    ON properties FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "properties_update_authenticated"
    ON properties FOR UPDATE
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR public.is_property_staff(id)  -- Uses function, bypasses RLS
    );

CREATE POLICY "properties_select_anon"
    ON properties FOR SELECT
    TO anon
    USING (
        booking_page_slug IS NOT NULL
        AND onboarding_completed = true
        AND status = 'active'
    );

-- ----------------------------------------
-- Property Staff (using public.is_property_owner)
-- ----------------------------------------

CREATE POLICY "property_staff_select"
    ON property_staff FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()  -- See your own records
        OR public.is_property_owner(property_id)  -- Uses function, bypasses RLS
    );

CREATE POLICY "property_staff_insert"
    ON property_staff FOR INSERT
    TO authenticated
    WITH CHECK (public.is_property_owner(property_id));

CREATE POLICY "property_staff_update"
    ON property_staff FOR UPDATE
    TO authenticated
    USING (public.is_property_owner(property_id))
    WITH CHECK (public.is_property_owner(property_id));

CREATE POLICY "property_staff_delete"
    ON property_staff FOR DELETE
    TO authenticated
    USING (public.is_property_owner(property_id));

-- ----------------------------------------
-- Sites (using public.get_accessible_property_ids)
-- ----------------------------------------

CREATE POLICY "sites_select_authenticated"
    ON sites FOR SELECT
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

CREATE POLICY "sites_insert_authenticated"
    ON sites FOR INSERT
    TO authenticated
    WITH CHECK (property_id IN (SELECT public.get_accessible_property_ids()));

CREATE POLICY "sites_update_authenticated"
    ON sites FOR UPDATE
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()))
    WITH CHECK (property_id IN (SELECT public.get_accessible_property_ids()));

CREATE POLICY "sites_delete_authenticated"
    ON sites FOR DELETE
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

CREATE POLICY "sites_select_anon"
    ON sites FOR SELECT
    TO anon
    USING (status = 'available');

-- ----------------------------------------
-- Guests
-- ----------------------------------------

CREATE POLICY "guests_authenticated"
    ON guests FOR ALL
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

CREATE POLICY "guests_anon_insert"
    ON guests FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "guests_anon_select"
    ON guests FOR SELECT
    TO anon
    USING (true);

-- ----------------------------------------
-- Reservations
-- ----------------------------------------

CREATE POLICY "reservations_authenticated"
    ON reservations FOR ALL
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

CREATE POLICY "reservations_anon_insert"
    ON reservations FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "reservations_anon_select"
    ON reservations FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "reservations_anon_update"
    ON reservations FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------
-- Payments
-- ----------------------------------------

CREATE POLICY "payments_authenticated"
    ON payments FOR ALL
    TO authenticated
    USING (property_id IN (SELECT public.get_accessible_property_ids()));

CREATE POLICY "payments_anon_insert"
    ON payments FOR INSERT
    TO anon
    WITH CHECK (true);

-- ============================================================================
-- STEP 4: Grant execute permissions on helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_property_owner(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_property_staff(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_accessible_property_ids() TO authenticated, anon;

-- ============================================================================
-- Verification
-- ============================================================================

-- Test that anonymous users can query without recursion
-- SET ROLE anon;
-- SELECT COUNT(*) FROM sites WHERE status = 'available';
-- SELECT COUNT(*) FROM properties WHERE booking_page_slug IS NOT NULL;
-- RESET ROLE;
