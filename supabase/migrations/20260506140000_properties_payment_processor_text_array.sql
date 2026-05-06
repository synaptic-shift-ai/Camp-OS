-- Store multiple payment processor identifiers per property; no value whitelist.
-- Migrates legacy single TEXT values to a one-element text array.

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_payment_processor_check;

DROP INDEX IF EXISTS idx_properties_payment_processor;

ALTER TABLE properties
  ALTER COLUMN payment_processor DROP DEFAULT;

ALTER TABLE properties
  ALTER COLUMN payment_processor TYPE text[]
  USING ARRAY[payment_processor]::text[];

ALTER TABLE properties
  ALTER COLUMN payment_processor SET DEFAULT ARRAY['stripe']::text[];

ALTER TABLE properties
  ALTER COLUMN payment_processor SET NOT NULL;

CREATE INDEX idx_properties_payment_processor_gin
  ON properties USING GIN (payment_processor);
