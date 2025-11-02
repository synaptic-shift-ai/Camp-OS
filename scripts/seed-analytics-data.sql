-- ============================================================================
-- Seed Analytics Data for Dashboard Testing
-- ============================================================================
-- This script creates realistic seed data for testing the analytics dashboard:
-- - 50+ guests with varied information
-- - 100+ reservations spanning past 12 months
-- - Multiple payment methods and statuses
-- - Various reservation sources (direct, booking.com, airbnb)
--
-- USAGE:
-- 1. Replace YOUR_PROPERTY_ID with your actual property UUID
-- 2. Run this script in Supabase SQL Editor or psql
-- 3. Refresh your analytics dashboard
-- ============================================================================

-- ============================================================================
-- Configuration: SET YOUR PROPERTY ID HERE
-- ============================================================================
\set property_id '86ab6f78-9c2c-45bb-9c6d-4c107a060c3c'

DO $$
DECLARE
  v_property_id UUID := '86ab6f78-9c2c-45bb-9c6d-4c107a060c3c'; -- CHANGE THIS TO YOUR PROPERTY ID
  v_site_ids UUID[];
  v_guest_ids UUID[];
  v_confirmation_num TEXT;
  v_check_in DATE;
  v_check_out DATE;
  v_nights INT;
  v_total_cents BIGINT;
  v_paid_cents BIGINT;
  v_reservation_id UUID;
  v_payment_methods TEXT[] := ARRAY['credit_card', 'debit_card', 'cash', 'bank_transfer'];
  v_sources TEXT[] := ARRAY['direct', 'direct', 'direct', 'booking_com', 'airbnb', 'direct'];
  v_statuses TEXT[] := ARRAY['confirmed', 'confirmed', 'confirmed', 'checked_in', 'checked_out', 'confirmed'];
  v_month_offset INT;
  v_i INT;
  v_guest_names TEXT[][] := ARRAY[
    ARRAY['John', 'Smith'],
    ARRAY['Sarah', 'Johnson'],
    ARRAY['Michael', 'Williams'],
    ARRAY['Emily', 'Brown'],
    ARRAY['David', 'Jones'],
    ARRAY['Jessica', 'Garcia'],
    ARRAY['James', 'Miller'],
    ARRAY['Ashley', 'Davis'],
    ARRAY['Robert', 'Rodriguez'],
    ARRAY['Lisa', 'Martinez'],
    ARRAY['William', 'Hernandez'],
    ARRAY['Jennifer', 'Lopez'],
    ARRAY['Richard', 'Gonzalez'],
    ARRAY['Amanda', 'Wilson'],
    ARRAY['Christopher', 'Anderson'],
    ARRAY['Michelle', 'Thomas'],
    ARRAY['Daniel', 'Taylor'],
    ARRAY['Melissa', 'Moore'],
    ARRAY['Matthew', 'Jackson'],
    ARRAY['Laura', 'Martin'],
    ARRAY['Anthony', 'Lee'],
    ARRAY['Stephanie', 'Perez'],
    ARRAY['Mark', 'Thompson'],
    ARRAY['Nicole', 'White'],
    ARRAY['Steven', 'Harris'],
    ARRAY['Angela', 'Sanchez'],
    ARRAY['Kevin', 'Clark'],
    ARRAY['Rebecca', 'Ramirez'],
    ARRAY['Brian', 'Lewis'],
    ARRAY['Elizabeth', 'Robinson'],
    ARRAY['Kenneth', 'Walker'],
    ARRAY['Kimberly', 'Young'],
    ARRAY['Joshua', 'Allen'],
    ARRAY['Michelle', 'King'],
    ARRAY['Andrew', 'Wright'],
    ARRAY['Sarah', 'Scott'],
    ARRAY['Thomas', 'Torres'],
    ARRAY['Karen', 'Nguyen'],
    ARRAY['Charles', 'Hill'],
    ARRAY['Nancy', 'Flores'],
    ARRAY['Joseph', 'Green'],
    ARRAY['Betty', 'Adams'],
    ARRAY['Paul', 'Nelson'],
    ARRAY['Helen', 'Baker'],
    ARRAY['Donald', 'Hall'],
    ARRAY['Sandra', 'Rivera'],
    ARRAY['George', 'Campbell'],
    ARRAY['Dorothy', 'Mitchell'],
    ARRAY['Ronald', 'Carter'],
    ARRAY['Carol', 'Roberts']
  ];
BEGIN

  RAISE NOTICE 'Starting seed data generation for property: %', v_property_id;

  -- ============================================================================
  -- Step 1: Get all site IDs for this property
  -- ============================================================================
  SELECT ARRAY_AGG(id) INTO v_site_ids
  FROM sites
  WHERE property_id = v_property_id
    AND status = 'available';

  IF array_length(v_site_ids, 1) IS NULL OR array_length(v_site_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No available sites found for property. Run setup-test-data.sql first!';
  END IF;

  RAISE NOTICE 'Found % available sites', array_length(v_site_ids, 1);

  -- ============================================================================
  -- Step 2: Create Guest Records
  -- ============================================================================
  RAISE NOTICE 'Creating guest records...';

  FOR v_i IN 1..array_length(v_guest_names, 1) LOOP
    INSERT INTO guests (
      property_id,
      first_name,
      last_name,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
      country,
      created_at
    ) VALUES (
      v_property_id,
      v_guest_names[v_i][1],
      v_guest_names[v_i][2],
      LOWER(v_guest_names[v_i][1] || '.' || v_guest_names[v_i][2]) || '@email.com',
      '555-' || LPAD((100 + v_i)::TEXT, 4, '0'),
      (100 + v_i) || ' Main Street',
      CASE (v_i % 5)
        WHEN 0 THEN 'Portland'
        WHEN 1 THEN 'Seattle'
        WHEN 2 THEN 'Denver'
        WHEN 3 THEN 'Austin'
        ELSE 'Phoenix'
      END,
      CASE (v_i % 5)
        WHEN 0 THEN 'OR'
        WHEN 1 THEN 'WA'
        WHEN 2 THEN 'CO'
        WHEN 3 THEN 'TX'
        ELSE 'AZ'
      END,
      LPAD((97000 + v_i)::TEXT, 5, '0'),
      'USA',
      NOW() - (v_i || ' days')::INTERVAL
    );
  END LOOP;

  -- Get all guest IDs
  SELECT ARRAY_AGG(id) INTO v_guest_ids
  FROM guests
  WHERE property_id = v_property_id;

  RAISE NOTICE 'Created % guests', array_length(v_guest_ids, 1);

  -- ============================================================================
  -- Step 3: Create Historical Reservations (past 12 months)
  -- ============================================================================
  RAISE NOTICE 'Creating historical reservations...';

  FOR v_month_offset IN 0..11 LOOP
    -- Create 8-12 reservations per month
    FOR v_i IN 1..(8 + (v_month_offset % 5)) LOOP

      -- Random check-in date within the month
      v_check_in := (CURRENT_DATE - (v_month_offset || ' months')::INTERVAL)::DATE
                    + (FLOOR(RANDOM() * 28))::INT;

      -- Random stay length (2-7 nights)
      v_nights := 2 + (FLOOR(RANDOM() * 6))::INT;
      v_check_out := v_check_in + v_nights;

      -- Skip if check-in is in the future
      CONTINUE WHEN v_check_in > CURRENT_DATE;

      -- Generate confirmation number
      v_confirmation_num := 'CAMP-' || TO_CHAR(v_check_in, 'YYYYMM') || '-' || LPAD(v_i::TEXT, 4, '0');

      -- Random pricing (between $45 and $150 per night in cents)
      v_total_cents := v_nights * (4500 + FLOOR(RANDOM() * 10500))::BIGINT;

      -- Determine payment status based on reservation status and check-in date
      IF v_check_in < CURRENT_DATE - 30 THEN
        -- Old reservations are fully paid
        v_paid_cents := v_total_cents;
      ELSIF v_check_in < CURRENT_DATE THEN
        -- Recent checked-in/out reservations are mostly paid
        v_paid_cents := CASE
          WHEN RANDOM() < 0.8 THEN v_total_cents
          ELSE v_total_cents / 2
        END;
      ELSE
        -- Future reservations may have deposits
        v_paid_cents := CASE
          WHEN RANDOM() < 0.5 THEN v_total_cents / 2
          ELSE 0
        END;
      END IF;

      -- Insert reservation
      INSERT INTO reservations (
        property_id,
        site_id,
        guest_id,
        confirmation_number,
        check_in_date,
        check_out_date,
        num_adults,
        num_children,
        num_pets,
        num_vehicles,
        status,
        total_amount,
        paid_amount,
        payment_status,
        source,
        created_at
      ) VALUES (
        v_property_id,
        v_site_ids[1 + (v_i % array_length(v_site_ids, 1))], -- Rotate through sites
        v_guest_ids[1 + ((v_month_offset * 8 + v_i) % array_length(v_guest_ids, 1))],
        v_confirmation_num,
        v_check_in,
        v_check_out,
        1 + (FLOOR(RANDOM() * 4))::INT, -- 1-4 adults
        (FLOOR(RANDOM() * 3))::INT,     -- 0-2 children
        CASE WHEN RANDOM() < 0.3 THEN 1 ELSE 0 END, -- 30% have pets
        1 + (FLOOR(RANDOM() * 2))::INT, -- 1-2 vehicles
        CASE
          WHEN v_check_out < CURRENT_DATE THEN 'checked_out'
          WHEN v_check_in <= CURRENT_DATE THEN 'checked_in'
          WHEN RANDOM() < 0.05 THEN 'cancelled'
          ELSE 'confirmed'
        END,
        v_total_cents,
        v_paid_cents,
        CASE
          WHEN v_paid_cents = 0 THEN 'unpaid'
          WHEN v_paid_cents >= v_total_cents THEN 'paid'
          ELSE 'partial'
        END,
        v_sources[1 + (FLOOR(RANDOM() * array_length(v_sources, 1)))::INT],
        v_check_in - (FLOOR(RANDOM() * 30) + 1)::INT -- Created 1-30 days before check-in
      )
      RETURNING id INTO v_reservation_id;

      -- ============================================================================
      -- Step 4: Create Payment Records for each Reservation
      -- ============================================================================

      -- Create initial payment (deposit or full amount)
      IF v_paid_cents > 0 THEN
        -- First payment
        INSERT INTO payments (
          property_id,
          reservation_id,
          amount,
          payment_method,
          payment_status,
          processed_at,
          created_at
        ) VALUES (
          v_property_id,
          v_reservation_id,
          CASE WHEN v_paid_cents >= v_total_cents
            THEN v_total_cents
            ELSE v_paid_cents
          END,
          v_payment_methods[1 + (FLOOR(RANDOM() * array_length(v_payment_methods, 1)))::INT],
          'completed',
          v_check_in - (FLOOR(RANDOM() * 29) + 1)::INT,
          v_check_in - (FLOOR(RANDOM() * 30) + 1)::INT
        );

        -- Second payment if partial
        IF v_paid_cents < v_total_cents AND v_paid_cents = v_total_cents / 2 THEN
          INSERT INTO payments (
            property_id,
            reservation_id,
            amount,
            payment_method,
            payment_status,
            processed_at,
            created_at
          ) VALUES (
            v_property_id,
            v_reservation_id,
            v_total_cents - v_paid_cents,
            v_payment_methods[1 + (FLOOR(RANDOM() * array_length(v_payment_methods, 1)))::INT],
            CASE
              WHEN v_check_in < CURRENT_DATE THEN 'completed'
              ELSE 'pending'
            END,
            CASE
              WHEN v_check_in < CURRENT_DATE THEN v_check_in
              ELSE NULL
            END,
            v_check_in - 1
          );
        END IF;
      END IF;

    END LOOP;
  END LOOP;

  -- ============================================================================
  -- Summary Report
  -- ============================================================================
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Seed data generation complete!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';

  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Guests created: %', (SELECT COUNT(*) FROM guests WHERE property_id = v_property_id);
  RAISE NOTICE '  - Reservations created: %', (SELECT COUNT(*) FROM reservations WHERE property_id = v_property_id);
  RAISE NOTICE '  - Payments created: %', (SELECT COUNT(*) FROM payments WHERE property_id = v_property_id);
  RAISE NOTICE '';

  RAISE NOTICE 'Reservation Status Breakdown:';
  RAISE NOTICE '  - Confirmed: %', (SELECT COUNT(*) FROM reservations WHERE property_id = v_property_id AND status = 'confirmed');
  RAISE NOTICE '  - Checked In: %', (SELECT COUNT(*) FROM reservations WHERE property_id = v_property_id AND status = 'checked_in');
  RAISE NOTICE '  - Checked Out: %', (SELECT COUNT(*) FROM reservations WHERE property_id = v_property_id AND status = 'checked_out');
  RAISE NOTICE '  - Cancelled: %', (SELECT COUNT(*) FROM reservations WHERE property_id = v_property_id AND status = 'cancelled');
  RAISE NOTICE '';

  RAISE NOTICE 'Payment Status Breakdown:';
  RAISE NOTICE '  - Paid: %', (SELECT COUNT(*) FROM reservations WHERE property_id = v_property_id AND payment_status = 'paid');
  RAISE NOTICE '  - Partial: %', (SELECT COUNT(*) FROM reservations WHERE property_id = v_property_id AND payment_status = 'partial');
  RAISE NOTICE '  - Unpaid: %', (SELECT COUNT(*) FROM reservations WHERE property_id = v_property_id AND payment_status = 'unpaid');
  RAISE NOTICE '';

  RAISE NOTICE 'Revenue Summary:';
  RAISE NOTICE '  - Total Revenue: $%', (SELECT ROUND(SUM(paid_amount) / 100.0, 2) FROM reservations WHERE property_id = v_property_id);
  RAISE NOTICE '  - Pending Payments: $%', (SELECT ROUND(SUM(total_amount - paid_amount) / 100.0, 2) FROM reservations WHERE property_id = v_property_id AND payment_status != 'paid' AND status != 'cancelled');
  RAISE NOTICE '';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Refresh your analytics dashboard to see the new data!';
  RAISE NOTICE '=================================================================';

END $$;

-- ============================================================================
-- Verification Queries (optional)
-- ============================================================================

-- View recent reservations
SELECT
  confirmation_number,
  check_in_date,
  check_out_date,
  status,
  payment_status,
  total_amount / 100.0 as total_dollars,
  paid_amount / 100.0 as paid_dollars,
  source
FROM reservations
WHERE property_id = '86ab6f78-9c2c-45bb-9c6d-4c107a060c3c'
ORDER BY created_at DESC
LIMIT 10;

-- View payment methods distribution
SELECT
  payment_method,
  COUNT(*) as count,
  ROUND(SUM(amount) / 100.0, 2) as total_dollars
FROM payments
WHERE property_id = '86ab6f78-9c2c-45bb-9c6d-4c107a060c3c'
GROUP BY payment_method
ORDER BY total_dollars DESC;

-- View monthly revenue
SELECT
  TO_CHAR(check_in_date, 'YYYY-MM') as month,
  COUNT(*) as bookings,
  ROUND(SUM(paid_amount) / 100.0, 2) as revenue_dollars
FROM reservations
WHERE property_id = '86ab6f78-9c2c-45bb-9c6d-4c107a060c3c'
  AND status != 'cancelled'
GROUP BY TO_CHAR(check_in_date, 'YYYY-MM')
ORDER BY month DESC
LIMIT 12;
