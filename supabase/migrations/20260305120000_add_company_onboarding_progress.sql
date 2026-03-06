-- Add company-level onboarding progress so users can resume where they left off
-- onboarding_step: current step (company_details, property_details, sites_setup, etc.)
-- onboarding_completed: true when full onboarding (through property wizard) is done

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.onboarding_step IS 'Current onboarding step for resume: company_details, property_details, sites_setup, dashboard_tour, stripe_connect, review_launch, or completed';
COMMENT ON COLUMN companies.onboarding_completed IS 'True when company onboarding (through property wizard) is fully complete';
