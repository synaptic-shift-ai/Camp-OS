-- Migration: Add API Audit Log Table
-- NOTE: Made idempotent for branch creation support
-- Description: Tracks all API requests for security, debugging, and analytics
-- Created: 2025-11-05
-- Phase: Phase 0, Week 2 - API Standards & Database Enhancements

-- Create api_audit_log table
CREATE TABLE IF NOT EXISTS public.api_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE, -- X-Request-ID header
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for unauthenticated requests
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,

    -- Request details
    method TEXT NOT NULL, -- GET, POST, PATCH, DELETE
    path TEXT NOT NULL, -- /api/v1/sites/123
    api_version TEXT, -- 1.0
    query_params JSONB, -- Query parameters as JSON
    request_body JSONB, -- Request body (may be NULL for GET)
    request_headers JSONB, -- Selected headers (User-Agent, etc.)

    -- Response details
    status_code INTEGER NOT NULL, -- HTTP status code
    response_body JSONB, -- Response body (may be truncated for large responses)
    error_code TEXT, -- Error code if error response (e.g., SITE_001)

    -- Metadata
    duration_ms INTEGER, -- Request duration in milliseconds
    ip_address INET, -- Client IP address
    user_agent TEXT, -- User agent string

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes
    CONSTRAINT api_audit_log_request_id_key UNIQUE (request_id)
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_api_audit_log_user_id
ON public.api_audit_log (user_id, created_at DESC);

-- Index for querying by company
CREATE INDEX IF NOT EXISTS idx_api_audit_log_company_id
ON public.api_audit_log (company_id, created_at DESC);

-- Index for querying by property
CREATE INDEX IF NOT EXISTS idx_api_audit_log_property_id
ON public.api_audit_log (property_id, created_at DESC);

-- Index for querying by path (API usage analytics)
CREATE INDEX IF NOT EXISTS idx_api_audit_log_path
ON public.api_audit_log (path, created_at DESC);

-- Index for querying errors
CREATE INDEX IF NOT EXISTS idx_api_audit_log_errors
ON public.api_audit_log (error_code, created_at DESC)
WHERE error_code IS NOT NULL;

-- Index for querying slow requests
CREATE INDEX IF NOT EXISTS idx_api_audit_log_duration
ON public.api_audit_log (duration_ms DESC, created_at DESC)
WHERE duration_ms > 1000; -- Only index requests > 1 second

-- Index for recent logs (most common query)
CREATE INDEX IF NOT EXISTS idx_api_audit_log_created_at
ON public.api_audit_log (created_at DESC);

-- Add comments
COMMENT ON TABLE public.api_audit_log IS 'Audit log of all API requests for security, debugging, and analytics';
COMMENT ON COLUMN public.api_audit_log.request_id IS 'Unique request ID from X-Request-ID header';
COMMENT ON COLUMN public.api_audit_log.method IS 'HTTP method (GET, POST, PATCH, DELETE, etc.)';
COMMENT ON COLUMN public.api_audit_log.path IS 'API endpoint path';
COMMENT ON COLUMN public.api_audit_log.api_version IS 'API version (e.g., 1.0)';
COMMENT ON COLUMN public.api_audit_log.status_code IS 'HTTP response status code';
COMMENT ON COLUMN public.api_audit_log.error_code IS 'Application error code if error occurred';
COMMENT ON COLUMN public.api_audit_log.duration_ms IS 'Request duration in milliseconds';

-- Enable Row Level Security
ALTER TABLE public.api_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role full access (for middleware to write) (idempotent)
DROP POLICY IF EXISTS "Service role full access on api_audit_log" ON public.api_audit_log;
CREATE POLICY "Service role full access on api_audit_log"
ON public.api_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policy: Admins can read logs for their properties (idempotent)
-- (In the future, add role-based access)
DROP POLICY IF EXISTS "Property owners can read their api logs" ON public.api_audit_log;
CREATE POLICY "Property owners can read their api logs"
ON public.api_audit_log
FOR SELECT
TO authenticated
USING (
    property_id IN (
        SELECT id FROM public.properties
        WHERE user_id = auth.uid()
    )
);

-- Grant permissions
GRANT SELECT ON public.api_audit_log TO authenticated;
GRANT ALL ON public.api_audit_log TO service_role;

-- Function to cleanup old audit logs (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_api_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.api_audit_log
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_api_audit_logs IS 'Deletes API audit logs older than specified days (default 90)';

-- Example: Delete logs older than 90 days
-- SELECT public.cleanup_old_api_audit_logs(90);
