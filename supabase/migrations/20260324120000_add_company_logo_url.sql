-- Store an optional company logo URL for account/profile branding
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

COMMENT ON COLUMN companies.company_logo_url IS 'Optional public URL for the company logo image used in dashboard/account branding';
