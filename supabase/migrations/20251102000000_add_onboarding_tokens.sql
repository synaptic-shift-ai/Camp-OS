-- Add onboarding token columns to companies table for magic link authentication
-- This allows users to be automatically authenticated when clicking email onboarding links

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS onboarding_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS onboarding_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_token_used_at TIMESTAMPTZ;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_companies_onboarding_token
  ON companies(onboarding_token)
  WHERE onboarding_token IS NOT NULL AND onboarding_token_used_at IS NULL;

-- Comments for documentation
COMMENT ON COLUMN companies.onboarding_token IS 'Secure random token for magic link authentication from onboarding email';
COMMENT ON COLUMN companies.onboarding_token_expires_at IS 'Token expiration timestamp (typically 7 days from creation)';
COMMENT ON COLUMN companies.onboarding_token_used_at IS 'Timestamp when token was used for authentication (null if unused)';
