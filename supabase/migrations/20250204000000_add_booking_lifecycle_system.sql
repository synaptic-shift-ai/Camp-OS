-- Booking Lifecycle & Extension System
-- Adds support for extensions, renewals, modifications across all booking types
-- Part 1: Core tables and reservation enhancements

-- ============================================================================
-- 1. Reservation Actions Table (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reservation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  -- Action type and details
  action_type VARCHAR(50) NOT NULL
    CHECK (action_type IN ('created', 'extended', 'renewed', 'modified', 'cancelled', 'rebooked', 'site_changed', 'type_converted')),
  action_details JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Who performed this action
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Financial impact
  price_change_cents INTEGER DEFAULT 0,
  payment_id UUID REFERENCES payments(id),

  -- State snapshots for audit trail
  previous_state JSONB,
  new_state JSONB,

  -- Additional context
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_reservation_actions_reservation ON reservation_actions(reservation_id);
CREATE INDEX idx_reservation_actions_type ON reservation_actions(action_type);
CREATE INDEX idx_reservation_actions_performed_at ON reservation_actions(performed_at DESC);

-- Comments for documentation
COMMENT ON TABLE reservation_actions IS 'Audit trail for all reservation modifications (extensions, renewals, date changes)';
COMMENT ON COLUMN reservation_actions.action_details IS 'Type-specific data: { nights_added, original_checkout, new_checkout } for extensions';
COMMENT ON COLUMN reservation_actions.price_change_cents IS 'Financial impact in cents (can be positive or negative)';
COMMENT ON COLUMN reservation_actions.previous_state IS 'Snapshot of reservation before action';
COMMENT ON COLUMN reservation_actions.new_state IS 'Snapshot of reservation after action';

-- ============================================================================
-- 2. Payment Installments Table (Multi-Step Payments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  -- Installment details
  installment_number INTEGER NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  due_date DATE NOT NULL,

  -- Payment status
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'waived', 'cancelled')),
  payment_id UUID REFERENCES payments(id),

  -- Metadata
  notes TEXT,
  reminder_sent_at TIMESTAMPTZ[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique installment numbers per reservation
  CONSTRAINT unique_reservation_installment UNIQUE(reservation_id, installment_number)
);

-- Indexes
CREATE INDEX idx_payment_installments_reservation ON payment_installments(reservation_id);
CREATE INDEX idx_payment_installments_due_date ON payment_installments(due_date, status);
CREATE INDEX idx_payment_installments_status ON payment_installments(status);

-- Comments
COMMENT ON TABLE payment_installments IS 'Multi-step payment schedules for long-term bookings and renewals';
COMMENT ON COLUMN payment_installments.installment_number IS 'Sequential number: 1, 2, 3... for display order';
COMMENT ON COLUMN payment_installments.description IS 'Human-readable: "Seasonal Deposit", "Balance Due", "October Rent"';
COMMENT ON COLUMN payment_installments.reminder_sent_at IS 'Array of timestamps when payment reminders were sent';

-- ============================================================================
-- 3. Extend Reservations Table (Booking Lifecycle Fields)
-- ============================================================================

-- Add booking type support
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(50) DEFAULT 'nightly'
  CHECK (booking_type IN ('nightly', 'weekly', 'monthly', 'seasonal', 'long_term'));

-- Add booking period metadata (for seasonal/monthly bookings)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS booking_period JSONB;

-- Relationship tracking
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS parent_reservation_id UUID REFERENCES reservations(id),
ADD COLUMN IF NOT EXISTS is_extension_of UUID REFERENCES reservations(id);

-- Immutable original dates (for tracking modifications)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS original_check_in DATE,
ADD COLUMN IF NOT EXISTS original_check_out DATE;

-- Modification tracking
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS times_extended INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS times_modified INTEGER DEFAULT 0;

-- Renewal workflow support
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS renewal_status VARCHAR(50) DEFAULT 'n/a'
  CHECK (renewal_status IN ('n/a', 'eligible', 'offered', 'accepted', 'declined', 'expired')),
ADD COLUMN IF NOT EXISTS renewal_offered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS renewal_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS renewal_notes TEXT;

-- Indexes for renewal queries
CREATE INDEX IF NOT EXISTS idx_reservations_booking_type ON reservations(booking_type);
CREATE INDEX IF NOT EXISTS idx_reservations_renewal_status ON reservations(renewal_status);
CREATE INDEX IF NOT EXISTS idx_reservations_parent ON reservations(parent_reservation_id);

-- Comments
COMMENT ON COLUMN reservations.booking_type IS 'Type of booking: nightly (standard), weekly, monthly, seasonal, long_term';
COMMENT ON COLUMN reservations.booking_period IS 'For seasonal/monthly: { season: "Summer 2025", start_date: "2025-05-01", end_date: "2025-10-31" }';
COMMENT ON COLUMN reservations.parent_reservation_id IS 'Links to previous period if this is a renewal (e.g., Summer 2025 → Summer 2024)';
COMMENT ON COLUMN reservations.is_extension_of IS 'Links to original reservation if this was split due to extension conflicts';
COMMENT ON COLUMN reservations.original_check_in IS 'Immutable original check-in date (for audit trail)';
COMMENT ON COLUMN reservations.original_check_out IS 'Immutable original check-out date (for audit trail)';
COMMENT ON COLUMN reservations.times_extended IS 'Counter: how many times this reservation was extended';
COMMENT ON COLUMN reservations.times_modified IS 'Counter: how many times dates were modified';
COMMENT ON COLUMN reservations.renewal_status IS 'Renewal workflow state for seasonal/monthly bookings';
COMMENT ON COLUMN reservations.renewal_deadline IS 'Deadline for guest to accept renewal offer';

-- ============================================================================
-- 4. Add Renewal Settings to Properties
-- ============================================================================

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS renewal_settings JSONB DEFAULT '{
  "seasonal_renewal_window_days": 30,
  "monthly_renewal_window_days": 7,
  "renewal_deposit_percentage": 25,
  "auto_release_on_decline": true,
  "send_renewal_reminders": true,
  "reminder_days_before": [7, 14, 21]
}'::jsonb;

COMMENT ON COLUMN properties.renewal_settings IS 'Property-level renewal configuration for seasonal/monthly bookings';

-- ============================================================================
-- 5. Trigger to Set Original Dates on Insert
-- ============================================================================

CREATE OR REPLACE FUNCTION set_original_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.original_check_in IS NULL THEN
    NEW.original_check_in := NEW.check_in_date;
  END IF;
  IF NEW.original_check_out IS NULL THEN
    NEW.original_check_out := NEW.check_out_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_original_dates
  BEFORE INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION set_original_dates();

-- ============================================================================
-- 6. RLS Policies for New Tables
-- ============================================================================

-- Enable RLS
ALTER TABLE reservation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;

-- Reservation Actions: Users can view/modify actions for their property's reservations
CREATE POLICY "Users can view reservation actions for their properties"
  ON reservation_actions FOR SELECT
  USING (
    reservation_id IN (
      SELECT id FROM reservations WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()
        UNION
        SELECT property_id FROM property_staff WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create reservation actions for their properties"
  ON reservation_actions FOR INSERT
  WITH CHECK (
    reservation_id IN (
      SELECT id FROM reservations WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()
        UNION
        SELECT property_id FROM property_staff WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'staff')
      )
    )
  );

-- Payment Installments: Same pattern as reservation actions
CREATE POLICY "Users can view payment installments for their properties"
  ON payment_installments FOR SELECT
  USING (
    reservation_id IN (
      SELECT id FROM reservations WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()
        UNION
        SELECT property_id FROM property_staff WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage payment installments for their properties"
  ON payment_installments FOR ALL
  USING (
    reservation_id IN (
      SELECT id FROM reservations WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()
        UNION
        SELECT property_id FROM property_staff WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'staff')
      )
    )
  );

-- ============================================================================
-- 7. Helper Functions
-- ============================================================================

-- Function to check if a reservation is eligible for renewal
CREATE OR REPLACE FUNCTION is_eligible_for_renewal(reservation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  res reservations;
  prop properties;
  days_until_end INTEGER;
  renewal_window INTEGER;
BEGIN
  SELECT * INTO res FROM reservations WHERE id = reservation_id;
  SELECT * INTO prop FROM properties WHERE id = res.property_id;

  days_until_end := res.check_out_date - CURRENT_DATE;

  -- Get renewal window based on booking type
  IF res.booking_type = 'seasonal' THEN
    renewal_window := COALESCE((prop.renewal_settings->>'seasonal_renewal_window_days')::INTEGER, 30);
  ELSIF res.booking_type IN ('monthly', 'long_term') THEN
    renewal_window := COALESCE((prop.renewal_settings->>'monthly_renewal_window_days')::INTEGER, 7);
  ELSE
    -- Nightly/weekly bookings not eligible for renewal
    RETURN FALSE;
  END IF;

  -- Eligible if within renewal window and status is confirmed or checked_in
  RETURN days_until_end <= renewal_window
    AND days_until_end > 0
    AND res.status IN ('confirmed', 'checked_in')
    AND res.renewal_status IN ('n/a', 'eligible');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_eligible_for_renewal IS 'Checks if a reservation is within the renewal window and eligible for renewal offer';

-- ============================================================================
-- Complete
-- ============================================================================
