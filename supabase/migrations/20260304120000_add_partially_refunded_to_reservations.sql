-- Migration: Add partially_refunded to reservations.status and reservations.payment_status
-- Purpose: Allow reservations to have status = 'partially_refunded' and payment_status = 'partially_refunded'
--          when cancelled with a partial refund (refund_amount_cents < paid_amount).
-- Date: 2026-03-04

-- 1) Allow 'partially_refunded' in reservation lifecycle status
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled', 'partially_refunded', 'no_show'));

-- 2) Allow 'partially_refunded' in payment_status
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_payment_status_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_payment_status_check
  CHECK (payment_status IN ('pending', 'partial', 'paid', 'partially_refunded', 'refunded'));
