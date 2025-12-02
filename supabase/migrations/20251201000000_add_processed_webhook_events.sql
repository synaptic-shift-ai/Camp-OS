-- Processed Webhook Events Table
-- Provides idempotency guarantees for Stripe webhook processing
-- Prevents duplicate company/subscription creation from webhook retries

-- ============================================================================
-- PROCESSED WEBHOOK EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS processed_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Stripe event identifier (unique across all Stripe events)
    stripe_event_id TEXT NOT NULL UNIQUE,

    -- Event type for filtering/debugging
    event_type TEXT NOT NULL,

    -- Processing status
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'skipped')),

    -- Optional: Link to created entities for debugging
    created_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    created_property_ids UUID[] DEFAULT '{}',

    -- Processing metadata
    processing_time_ms INTEGER,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by stripe_event_id (already unique, but explicit)
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_stripe_event_id
ON processed_webhook_events(stripe_event_id);

-- Index for cleanup/retention queries
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_created_at
ON processed_webhook_events(created_at);

-- Index for monitoring failed events
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_status
ON processed_webhook_events(status) WHERE status != 'processed';

-- No RLS needed - this table is only accessed via service role in webhooks
-- But we'll enable it with a restrictive policy for defense-in-depth
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no user-facing access)
DROP POLICY IF EXISTS "No public access to webhook events" ON processed_webhook_events;
CREATE POLICY "No public access to webhook events"
ON processed_webhook_events
FOR ALL
USING (false);

-- Comments for documentation
COMMENT ON TABLE processed_webhook_events IS 'Idempotency tracking for Stripe webhook events';
COMMENT ON COLUMN processed_webhook_events.stripe_event_id IS 'Unique Stripe event ID (evt_xxx)';
COMMENT ON COLUMN processed_webhook_events.event_type IS 'Stripe event type (e.g., checkout.session.completed)';
COMMENT ON COLUMN processed_webhook_events.status IS 'Processing outcome: processed, failed, or skipped';
COMMENT ON COLUMN processed_webhook_events.created_company_id IS 'Company created by this event (for audit trail)';
COMMENT ON COLUMN processed_webhook_events.created_property_ids IS 'Properties created by this event';
