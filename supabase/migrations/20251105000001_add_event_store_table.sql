-- Migration: Add Event Store Table
-- Description: Stores domain events for event sourcing and audit trail
-- Created: 2025-11-05
-- Phase: Phase 0, Week 2 - API Standards & Database Enhancements

-- Create event_store table
CREATE TABLE IF NOT EXISTS public.event_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE, -- Domain event ID
    event_type TEXT NOT NULL, -- Class name of the event
    aggregate_type TEXT NOT NULL, -- Type of aggregate (e.g., 'Reservation', 'Site')
    aggregate_id TEXT NOT NULL, -- ID of the aggregate that generated the event
    event_data JSONB NOT NULL, -- Full event payload
    metadata JSONB, -- Additional metadata (user_id, ip_address, etc.)
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes for common queries
    CONSTRAINT event_store_event_id_key UNIQUE (event_id)
);

-- Index for querying events by aggregate
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate
ON public.event_store (aggregate_type, aggregate_id, occurred_at DESC);

-- Index for querying events by type
CREATE INDEX IF NOT EXISTS idx_event_store_event_type
ON public.event_store (event_type, occurred_at DESC);

-- Index for querying recent events
CREATE INDEX IF NOT EXISTS idx_event_store_occurred_at
ON public.event_store (occurred_at DESC);

-- Add comments
COMMENT ON TABLE public.event_store IS 'Stores domain events for event sourcing, audit trail, and module communication';
COMMENT ON COLUMN public.event_store.event_id IS 'Unique identifier for the domain event';
COMMENT ON COLUMN public.event_store.event_type IS 'Class name of the event (e.g., ReservationConfirmedEvent)';
COMMENT ON COLUMN public.event_store.aggregate_type IS 'Type of aggregate that generated the event';
COMMENT ON COLUMN public.event_store.aggregate_id IS 'ID of the aggregate instance';
COMMENT ON COLUMN public.event_store.event_data IS 'Full event payload as JSON';
COMMENT ON COLUMN public.event_store.metadata IS 'Additional context (user_id, request_id, etc.)';
COMMENT ON COLUMN public.event_store.occurred_at IS 'When the event occurred in the domain';

-- Enable Row Level Security
ALTER TABLE public.event_store ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can do anything (for EventBus to write)
CREATE POLICY "Service role full access on event_store"
ON public.event_store
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policy: Authenticated users can read their company's events
-- (We'll refine this once we add company_id to events)
CREATE POLICY "Users can read event_store"
ON public.event_store
FOR SELECT
TO authenticated
USING (true);

-- Grant permissions
GRANT SELECT ON public.event_store TO authenticated;
GRANT ALL ON public.event_store TO service_role;
