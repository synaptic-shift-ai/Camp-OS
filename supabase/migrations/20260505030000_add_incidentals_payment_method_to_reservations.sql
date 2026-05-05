-- Add incidentals payment method column to reservations.
-- Stores a Stripe PaymentMethod ID for a separate card-on-file for incidentals,
-- distinct from the booking payment card.

ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS incidentals_payment_method_id TEXT NULL;

COMMENT ON COLUMN reservations.incidentals_payment_method_id IS 'Stripe PaymentMethod ID for incidentals card-on-file, separate from booking payment card';
