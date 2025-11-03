-- Migration: Add Pet and ADA Accessibility Fields to Sites
--
-- Purpose: Support pet-friendly sites and ADA accessibility features
-- - Add allow_pets (boolean) - whether pets are allowed
-- - Add pet_fee (integer) - one-time pet fee in cents
-- - Add ada_accessible (boolean) - ADA accessibility compliance
-- - Add accessibility_features (JSONB array) - specific accessibility features
--
-- After applying:
-- - Run: npm run gen:db to regenerate TypeScript types
-- - Update form UI to include these fields
-- - Guest booking portal will automatically calculate pet fees

BEGIN;

-- ============================================================================
-- Step 1: Add pet-related columns
-- ============================================================================

-- Add allow_pets flag (default false for existing sites)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'allow_pets'
  ) THEN
    ALTER TABLE sites ADD COLUMN allow_pets BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add pet_fee in cents (nullable - only set if pets are allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'pet_fee'
  ) THEN
    ALTER TABLE sites ADD COLUMN pet_fee INTEGER NULL;
  END IF;
END $$;

-- Add check constraint: pet_fee must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sites_pet_fee_nonnegative'
  ) THEN
    ALTER TABLE sites ADD CONSTRAINT sites_pet_fee_nonnegative CHECK (pet_fee >= 0);
  END IF;
END $$;

-- ============================================================================
-- Step 2: Add ADA accessibility columns
-- ============================================================================

-- Add ada_accessible flag (default false for existing sites)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'ada_accessible'
  ) THEN
    ALTER TABLE sites ADD COLUMN ada_accessible BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add accessibility_features JSONB array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'accessibility_features'
  ) THEN
    ALTER TABLE sites ADD COLUMN accessibility_features JSONB NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- Step 3: Add column documentation
-- ============================================================================

COMMENT ON COLUMN sites.allow_pets IS
  'Whether pets are allowed at this site. If true, pet_fee may apply.';

COMMENT ON COLUMN sites.pet_fee IS
  'One-time pet fee in cents. NULL if no fee or pets not allowed. Applied once per reservation regardless of number of pets.';

COMMENT ON COLUMN sites.ada_accessible IS
  'Whether this site meets ADA (Americans with Disabilities Act) accessibility standards.';

COMMENT ON COLUMN sites.accessibility_features IS
  'Array of specific accessibility features available at this site. Examples: ["wheelchair_accessible", "wide_paths", "accessible_table", "accessible_restroom", "handrails", "level_ground"]';

COMMIT;

-- ============================================================================
-- Post-migration notes:
-- ============================================================================
-- 1. Run: npm run gen:db (or equivalent type generation command)
-- 2. Update Site type in lib/booking/types.ts with new fields
-- 3. Update site form schema in components/dashboard/setup-wizard/site-form-schema.ts
-- 4. Update site form UI in components/dashboard/setup-wizard/site-form.tsx
-- 5. Pricing engine (lib/booking/pricing.ts) already supports pet fees!
-- 6. Add guest-facing pet input in site-details-client.tsx
-- 7. Test CSV import with pet and ADA fields
