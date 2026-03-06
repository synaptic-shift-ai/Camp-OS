-- Persist quick tour completion so the dashboard alert stays until user completes or dismisses
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS quick_tour_completed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.quick_tour_completed IS 'True when the owner completed or dismissed the post-onboarding dashboard quick tour';
