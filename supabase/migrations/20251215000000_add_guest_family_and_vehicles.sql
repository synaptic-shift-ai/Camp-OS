-- Migration: Add Guest Family Members and Vehicle Information
-- Purpose: Support spouse/partner info, children per reservation, and vehicle tracking
-- Date: 2025-12-15

-- ============================================================================
-- SPOUSE/PARTNER FIELDS ON GUESTS TABLE
-- Stored at guest level for reuse across reservations
-- ============================================================================

ALTER TABLE guests ADD COLUMN IF NOT EXISTS spouse_first_name VARCHAR(100);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS spouse_last_name VARCHAR(100);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS spouse_phone VARCHAR(50);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS spouse_email VARCHAR(255);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS spouse_is_alternate_contact BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- GUEST VEHICLES TABLE
-- Stored at guest level for reuse across reservations
-- Supports personal vehicles, RVs/campers, and tow vehicles
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_vehicles (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Vehicle Category
    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('personal', 'rv', 'tow_vehicle')),

    -- Personal Vehicle / Tow Vehicle Fields
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
    color VARCHAR(50),
    license_plate VARCHAR(20),
    license_plate_state VARCHAR(10),
    personal_vehicle_type VARCHAR(50) CHECK (
        personal_vehicle_type IS NULL OR
        personal_vehicle_type IN ('car', 'truck', 'suv', 'motorcycle', 'boat_trailer', 'other')
    ),

    -- RV/Camper Fields (only for vehicle_type = 'rv')
    rv_type VARCHAR(50) CHECK (
        rv_type IS NULL OR
        rv_type IN ('class_a', 'class_b', 'class_c', 'fifth_wheel', 'travel_trailer', 'popup', 'truck_camper', 'toy_hauler')
    ),
    rv_length_feet INTEGER CHECK (rv_length_feet IS NULL OR (rv_length_feet >= 10 AND rv_length_feet <= 60)),
    rv_width_feet INTEGER CHECK (rv_width_feet IS NULL OR (rv_width_feet >= 6 AND rv_width_feet <= 12)),
    num_slide_outs INTEGER DEFAULT 0 CHECK (num_slide_outs >= 0 AND num_slide_outs <= 10),

    -- Compliance Fields (optional)
    insurance_company VARCHAR(200),
    insurance_policy_number VARCHAR(100),

    -- Metadata
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id)
);

-- Indexes for guest_vehicles
CREATE INDEX IF NOT EXISTS idx_guest_vehicles_guest_id ON guest_vehicles(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_vehicles_property_id ON guest_vehicles(property_id);
CREATE INDEX IF NOT EXISTS idx_guest_vehicles_guest_property ON guest_vehicles(guest_id, property_id);

-- ============================================================================
-- RESERVATION CHILDREN TABLE
-- Stored per-reservation since children may vary per trip
-- ============================================================================

CREATE TABLE IF NOT EXISTS reservation_children (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Child Information
    first_name VARCHAR(100) NOT NULL,
    age INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 17)),
    date_of_birth DATE,
    special_needs_allergies TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id)
);

-- Indexes for reservation_children
CREATE INDEX IF NOT EXISTS idx_reservation_children_reservation_id ON reservation_children(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_children_property_id ON reservation_children(property_id);

-- ============================================================================
-- RESERVATION VEHICLES LINK TABLE
-- Links reservations to guest vehicles (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reservation_vehicles (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    guest_vehicle_id UUID NOT NULL REFERENCES guest_vehicles(id) ON DELETE CASCADE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id),
    UNIQUE(reservation_id, guest_vehicle_id)
);

-- Indexes for reservation_vehicles
CREATE INDEX IF NOT EXISTS idx_reservation_vehicles_reservation_id ON reservation_vehicles(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_vehicles_guest_vehicle_id ON reservation_vehicles(guest_vehicle_id);

-- ============================================================================
-- EVACUATION CONTACT ON RESERVATIONS
-- Emergency contact specifically for evacuation scenarios
-- ============================================================================

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS evacuation_contact_name VARCHAR(200);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS evacuation_contact_phone VARCHAR(50);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS evacuation_contact_relationship VARCHAR(100);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE guest_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_vehicles ENABLE ROW LEVEL SECURITY;

-- Guest Vehicles policies
CREATE POLICY "Users can view vehicles for guests in their properties" ON guest_vehicles
    FOR SELECT
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert vehicles for guests in their properties" ON guest_vehicles
    FOR INSERT
    WITH CHECK (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update vehicles for guests in their properties" ON guest_vehicles
    FOR UPDATE
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete vehicles for guests in their properties" ON guest_vehicles
    FOR DELETE
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

-- Reservation Children policies
CREATE POLICY "Users can view children for reservations in their properties" ON reservation_children
    FOR SELECT
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert children for reservations in their properties" ON reservation_children
    FOR INSERT
    WITH CHECK (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update children for reservations in their properties" ON reservation_children
    FOR UPDATE
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete children for reservations in their properties" ON reservation_children
    FOR DELETE
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

-- Reservation Vehicles policies
CREATE POLICY "Users can view reservation vehicles in their properties" ON reservation_vehicles
    FOR SELECT
    USING (
        reservation_id IN (
            SELECT r.id FROM reservations r
            WHERE r.property_id IN (
                SELECT id FROM properties WHERE owner_id = auth.uid()
                UNION
                SELECT property_id FROM property_staff WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert reservation vehicles in their properties" ON reservation_vehicles
    FOR INSERT
    WITH CHECK (
        reservation_id IN (
            SELECT r.id FROM reservations r
            WHERE r.property_id IN (
                SELECT id FROM properties WHERE owner_id = auth.uid()
                UNION
                SELECT property_id FROM property_staff WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete reservation vehicles in their properties" ON reservation_vehicles
    FOR DELETE
    USING (
        reservation_id IN (
            SELECT r.id FROM reservations r
            WHERE r.property_id IN (
                SELECT id FROM properties WHERE owner_id = auth.uid()
                UNION
                SELECT property_id FROM property_staff WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- SERVICE ROLE BYPASS POLICIES
-- Allow service role full access for API operations
-- ============================================================================

CREATE POLICY "Service role has full access to guest_vehicles" ON guest_vehicles
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to reservation_children" ON reservation_children
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to reservation_vehicles" ON reservation_vehicles
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER FOR GUEST_VEHICLES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_guest_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_guest_vehicles_updated_at
    BEFORE UPDATE ON guest_vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_vehicles_updated_at();
