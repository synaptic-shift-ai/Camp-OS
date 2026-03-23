-- Add terms and conditions text field to properties
-- Dedicated column for legal terms shown to guests during booking.

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

COMMENT ON COLUMN properties.terms_and_conditions IS
  'Property-specific terms and conditions presented to guests during booking/checkout.';
