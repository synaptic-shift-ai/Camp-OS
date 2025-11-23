-- ============================================================================
-- REFACTOR DATABASE SETUP SCRIPT
-- ============================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ydzpxvhfuviciqqslhuj/sql/new
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies Table (top-level tenant)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  subscription_id TEXT UNIQUE,
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete')),
  subscription_plan TEXT CHECK (subscription_plan IN ('starter', 'growth', 'pro', 'enterprise')),
  subscription_created_at TIMESTAMPTZ,
  subscription_canceled_at TIMESTAMPTZ,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties Table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    property_type VARCHAR(50) CHECK (property_type IN ('campground', 'rv_park', 'glamping', 'mixed')),
    description TEXT,
    amenities JSONB DEFAULT '[]'::jsonb,
    check_in_time TIME DEFAULT '15:00:00',
    check_out_time TIME DEFAULT '11:00:00',
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sites Table
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    site_number VARCHAR(50) NOT NULL,
    site_name VARCHAR(255),
    site_type VARCHAR(50) CHECK (site_type IN ('tent', 'rv', 'cabin', 'glamping', 'yurt', 'other')),
    max_occupancy INTEGER DEFAULT 4,
    max_vehicles INTEGER DEFAULT 1,
    size_sqft INTEGER,
    hookups JSONB DEFAULT '[]'::jsonb,
    amenities JSONB DEFAULT '[]'::jsonb,
    base_price_cents INTEGER NOT NULL DEFAULT 0,
    weekend_price_cents INTEGER,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'maintenance', 'reserved', 'booked')),
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    location_map JSONB,
    allows_pets BOOLEAN DEFAULT true,
    is_ada_accessible BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(property_id, site_number)
);

-- Guests Table
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    notes TEXT,
    stripe_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    confirmation_number VARCHAR(50) UNIQUE NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    num_adults INTEGER DEFAULT 1,
    num_children INTEGER DEFAULT 0,
    num_pets INTEGER DEFAULT 0,
    num_vehicles INTEGER DEFAULT 1,
    vehicle_info JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'reserved', 'booked')),
    total_amount_cents INTEGER NOT NULL DEFAULT 0,
    paid_amount_cents INTEGER DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
    special_requests TEXT,
    notes TEXT,
    source VARCHAR(50) DEFAULT 'direct',
    actual_check_in_time TIMESTAMP WITH TIME ZONE,
    actual_check_out_time TIMESTAMP WITH TIME ZONE,
    reserved_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    CHECK (check_out_date > check_in_date)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) CHECK (payment_method IN ('credit_card', 'debit_card', 'cash', 'check', 'bank_transfer', 'other')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    stripe_payment_id VARCHAR(255),
    transaction_id VARCHAR(255),
    notes TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property Staff Table
CREATE TABLE IF NOT EXISTS property_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff', 'viewer')),
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(property_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_company ON properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_slug ON properties(slug);
CREATE INDEX IF NOT EXISTS idx_sites_property ON sites(property_id);
CREATE INDEX IF NOT EXISTS idx_guests_property ON guests(property_id);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
CREATE INDEX IF NOT EXISTS idx_reservations_property ON reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_site ON reservations(site_id);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_property ON property_staff(property_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_user ON property_staff(user_id);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Companies
CREATE POLICY "Users can view their own companies"
  ON companies FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own companies"
  ON companies FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own companies"
  ON companies FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own companies"
  ON companies FOR DELETE
  USING (owner_id = auth.uid());

-- RLS Policies for Properties
CREATE POLICY "Users can view their properties"
  ON properties FOR SELECT
  USING (
    owner_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR id IN (SELECT property_id FROM property_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their own properties"
  ON properties FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their properties"
  ON properties FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR id IN (SELECT property_id FROM property_staff WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
  );

-- RLS Policies for Sites
CREATE POLICY "Users can view sites of their properties"
  ON sites FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage sites of their properties"
  ON sites FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- RLS Policies for Guests
CREATE POLICY "Users can view guests of their properties"
  ON guests FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage guests"
  ON guests FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for Reservations
CREATE POLICY "Users can view reservations of their properties"
  ON reservations FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage reservations"
  ON reservations FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for Payments
CREATE POLICY "Users can view payments of their properties"
  ON payments FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage payments"
  ON payments FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
      UNION
      SELECT property_id FROM property_staff WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for Property Staff
CREATE POLICY "Users can view staff of their properties"
  ON property_staff FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage staff"
  ON property_staff FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
      UNION
      SELECT id FROM properties WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    )
  );
