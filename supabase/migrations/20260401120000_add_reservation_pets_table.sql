-- Migration: Add Reservation Pets Table
-- Purpose: Store per-reservation pet details for guest bookings
-- Date: 2026-04-01

-- ============================================================================
-- RESERVATION PETS TABLE
-- Stored per-reservation since pets may vary per trip
-- ============================================================================

CREATE TABLE IF NOT EXISTS reservation_pets (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Pet Information
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('dog', 'cat', 'bird', 'other')),
    breed VARCHAR(100),
    weight_lbs NUMERIC(6,2) CHECK (weight_lbs IS NULL OR weight_lbs >= 0),
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id)
);

-- Indexes for reservation_pets
CREATE INDEX IF NOT EXISTS idx_reservation_pets_reservation_id ON reservation_pets(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_pets_property_id ON reservation_pets(property_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE reservation_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pets for reservations in their properties" ON reservation_pets
    FOR SELECT
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert pets for reservations in their properties" ON reservation_pets
    FOR INSERT
    WITH CHECK (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update pets for reservations in their properties" ON reservation_pets
    FOR UPDATE
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete pets for reservations in their properties" ON reservation_pets
    FOR DELETE
    USING (
        property_id IN (
            SELECT id FROM properties WHERE owner_id = auth.uid()
            UNION
            SELECT property_id FROM property_staff WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- SERVICE ROLE BYPASS POLICY
-- Allow service role full access for API operations
-- ============================================================================

CREATE POLICY "Service role has full access to reservation_pets" ON reservation_pets
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
