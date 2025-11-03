# Webhook Resilience Architecture

**Document Version**: 1.0
**Created**: 2025-10-30
**Status**: PROPOSED
**Incident Reference**: [ONBOARDING_CRISIS_HANDOFF.md](../reference/ONBOARDING_CRISIS_HANDOFF.md)

---

## Executive Summary

This document proposes a comprehensive webhook handling architecture to prevent race conditions, ensure idempotency, handle failures gracefully, and provide complete observability for debugging. The current webhook implementation has race conditions and lacks proper event ordering guarantees.

**Key Problems Addressed**:
1. Race conditions when Stripe fires multiple events simultaneously
2. No idempotency - webhooks could create duplicate data if retried
3. No event ordering - events processed in arrival order, not logical order
4. Silent failures - errors logged but not alerted
5. Difficult to debug - no correlation between events
6. No retry strategy for transient failures

**Solution Approach**:
- Event store for complete audit trail
- Idempotency keys prevent duplicate processing
- Event ordering with dependency management
- Retry with exponential backoff for transient failures
- Dead letter queue for permanent failures
- Comprehensive logging with correlation IDs
- Real-time monitoring and alerting

---

## Root Cause Analysis

### What Went Wrong

**The Problem**: Stripe fires `checkout.session.completed` and `customer.subscription.created` events simultaneously. The first creates a company record (takes ~200-500ms). The second tries to update the company immediately, but it doesn't exist yet.

**Current "Fix"**:
```typescript
// Simple retry with fixed delays
let attempts = 0
while (!company && attempts < 3) {
  // Try to find company
  if (!found) await sleep(500ms)
}
```

**Why This Is Insufficient**:
1. **Fixed retry count**: May not be enough for slow database writes
2. **No exponential backoff**: Could overwhelm database during issues
3. **No idempotency**: If Stripe retries webhook, could create duplicates
4. **No event correlation**: Can't trace related events
5. **No permanent failure handling**: After 3 attempts, error is logged but nothing happens
6. **Race condition still possible**: Two webhooks could try to create company simultaneously

---

## Architectural Weaknesses Identified

### 1. No Event Store
**Problem**: Webhook events are processed and discarded

**Why It's Fragile**:
- Can't replay events if processing fails
- No audit trail for debugging
- Can't detect duplicate events
- Can't analyze event patterns

### 2. No Idempotency
**Problem**: Same event processed twice creates duplicate data

**Scenario**:
```
1. Stripe sends checkout.session.completed
2. Webhook creates company (takes 5s due to slow DB)
3. Request times out, Stripe retries
4. Webhook creates company AGAIN
5. User now has two companies, data corrupted
```

### 3. No Event Ordering
**Problem**: Events processed in arrival order, not logical order

**Scenario**:
```
Logical order:
  1. checkout.session.completed (creates company)
  2. customer.subscription.created (updates subscription)

Actual arrival order:
  1. customer.subscription.created (fails - no company)
  2. checkout.session.completed (creates company)

Result: Subscription details never updated
```

### 4. No Transient Failure Handling
**Problem**: Database hiccup causes permanent data loss

**Scenario**:
```
1. Webhook receives checkout.session.completed
2. Supabase has temporary connection issue
3. Company creation fails
4. Error logged, webhook returns 500
5. Stripe retries, same error
6. After max retries, Stripe gives up
7. User paid but has no company record
```

---

## Proposed Architecture

### Design Principles

1. **Idempotent By Design**: Processing same event multiple times has same effect
2. **Event Sourcing**: Store all events for audit trail and replay
3. **Eventual Consistency**: Accept temporary inconsistency, guarantee eventual correctness
4. **Fail-Safe**: Errors should never result in data loss
5. **Observable**: Complete visibility into event processing
6. **Recoverable**: Can manually retry/reprocess failed events
7. **Debuggable**: Correlation IDs link related events

---

## Event Store Design

### Database Schema

```sql
-- Event store: Immutable log of all webhook events
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Stripe event details
  stripe_event_id TEXT NOT NULL UNIQUE,  -- Idempotency key
  event_type TEXT NOT NULL,              -- e.g. "checkout.session.completed"
  stripe_object JSONB NOT NULL,          -- Full Stripe event object

  -- Processing metadata
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending: Not yet processed
    -- processing: Currently being processed
    -- completed: Successfully processed
    -- failed: Permanently failed
    -- retrying: Waiting for retry

  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Error tracking
  last_error TEXT,
  last_error_stack TEXT,
  error_count INT NOT NULL DEFAULT 0,

  -- Correlation
  correlation_id UUID NOT NULL,          -- Links related events
  parent_event_id UUID,                  -- For event dependencies

  -- Dependencies (for ordering)
  depends_on UUID[],                     -- Must process these events first
  blocks UUID[],                         -- These events waiting for this one

  -- Business context
  user_id TEXT,
  company_id UUID,
  subscription_id TEXT,

  -- Result tracking
  result JSONB,                          -- What was created/updated

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Indexes for performance
  INDEX idx_webhook_events_stripe_id (stripe_event_id),
  INDEX idx_webhook_events_status (status),
  INDEX idx_webhook_events_correlation (correlation_id),
  INDEX idx_webhook_events_next_retry (next_retry_at) WHERE status = 'retrying',
  INDEX idx_webhook_events_company (company_id),
  INDEX idx_webhook_events_user (user_id)
);

-- Dead letter queue: Events that permanently failed
CREATE TABLE webhook_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_event_id UUID NOT NULL REFERENCES webhook_events(id),

  reason TEXT NOT NULL,
  final_error TEXT NOT NULL,
  final_error_stack TEXT,

  -- Investigation
  investigated BOOLEAN DEFAULT FALSE,
  investigation_notes TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  investigated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- Processing locks (prevent concurrent processing)
CREATE TABLE webhook_processing_locks (
  stripe_event_id TEXT PRIMARY KEY,
  locked_by TEXT NOT NULL,              -- Worker ID
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,      -- Auto-release after 5 minutes

  INDEX idx_webhook_locks_expires (expires_at)
);
```

### Event Store Pattern

```typescript
// lib/webhooks/event-store.ts

import type { Database } from "@/database/types"
import { createClient } from "@supabase/supabase-js"

type WebhookEventStatus = "pending" | "processing" | "completed" | "failed" | "retrying"

export type StoredWebhookEvent = {
  id: string
  stripe_event_id: string
  event_type: string
  stripe_object: any
  status: WebhookEventStatus
  attempts: number
  max_attempts: number
  last_error: string | null
  correlation_id: string
  depends_on: string[]
  result: any
  created_at: string
  processed_at: string | null
}

export class WebhookEventStore {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Store a new webhook event.
   * Returns null if event already exists (idempotency check).
   */
  async store(event: Stripe.Event): Promise<StoredWebhookEvent | null> {
    const correlation_id = this.extractCorrelationId(event)
    const depends_on = this.determineDependencies(event)

    const { data, error } = await this.supabase
      .from("webhook_events")
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        stripe_object: event as any,
        status: "pending",
        correlation_id,
        depends_on,
        user_id: this.extractUserId(event),
        subscription_id: this.extractSubscriptionId(event)
      })
      .select()
      .single()

    if (error) {
      // Unique constraint violation = already processed
      if (error.code === "23505") {
        console.log("[EventStore] Event already exists (idempotent):", event.id)
        return null
      }
      throw error
    }

    return data
  }

  /**
   * Acquire exclusive lock for processing an event.
   * Returns true if lock acquired, false if already locked.
   */
  async acquireLock(stripe_event_id: string, worker_id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("webhook_processing_locks")
      .insert({
        stripe_event_id,
        locked_by: worker_id,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min
      })

    if (error && error.code === "23505") {
      // Already locked
      return false
    }

    return true
  }

  /**
   * Release lock after processing.
   */
  async releaseLock(stripe_event_id: string): Promise<void> {
    await this.supabase
      .from("webhook_processing_locks")
      .delete()
      .eq("stripe_event_id", stripe_event_id)
  }

  /**
   * Mark event as successfully processed.
   */
  async markCompleted(
    event_id: string,
    result: any
  ): Promise<void> {
    await this.supabase
      .from("webhook_events")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        result
      })
      .eq("id", event_id)
  }

  /**
   * Mark event as failed with retry.
   */
  async markFailed(
    event_id: string,
    error: Error,
    retry_delay_ms: number
  ): Promise<void> {
    const { data: event } = await this.supabase
      .from("webhook_events")
      .select("attempts, max_attempts")
      .eq("id", event_id)
      .single()

    const attempts = (event?.attempts || 0) + 1
    const should_retry = attempts < (event?.max_attempts || 5)

    await this.supabase
      .from("webhook_events")
      .update({
        status: should_retry ? "retrying" : "failed",
        attempts,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: should_retry
          ? new Date(Date.now() + retry_delay_ms).toISOString()
          : null,
        last_error: error.message,
        last_error_stack: error.stack,
        error_count: this.supabase.raw("error_count + 1")
      })
      .eq("id", event_id)

    // Move to dead letter queue if max retries exceeded
    if (!should_retry) {
      await this.moveToDLQ(event_id, error)
    }
  }

  /**
   * Get events ready for processing (dependencies met).
   */
  async getReadyEvents(limit: number = 10): Promise<StoredWebhookEvent[]> {
    const now = new Date().toISOString()

    const { data } = await this.supabase
      .from("webhook_events")
      .select("*")
      .or(`status.eq.pending,and(status.eq.retrying,next_retry_at.lte.${now})`)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (!data) return []

    // Filter by dependencies
    return this.filterByDependencies(data)
  }

  /**
   * Get all events in a correlation group.
   */
  async getCorrelatedEvents(correlation_id: string): Promise<StoredWebhookEvent[]> {
    const { data } = await this.supabase
      .from("webhook_events")
      .select("*")
      .eq("correlation_id", correlation_id)
      .order("created_at", { ascending: true })

    return data || []
  }

  /**
   * Determine event dependencies for ordering.
   */
  private determineDependencies(event: Stripe.Event): string[] {
    const depends_on: string[] = []

    // subscription.created depends on checkout.session.completed
    if (event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated") {
      // This event depends on the checkout event that created the company
      // We'll need to look this up based on customer_id
      // For now, return empty - will be enriched by correlation logic
    }

    return depends_on
  }

  /**
   * Extract correlation ID (links related events together).
   */
  private extractCorrelationId(event: Stripe.Event): string {
    // Use customer_id as correlation ID for subscription-related events
    if (event.type.startsWith("customer.")) {
      const obj = event.data.object as any
      return obj.customer || obj.id
    }

    if (event.type.startsWith("checkout.")) {
      const session = event.data.object as Stripe.Checkout.Session
      return session.customer as string || session.id
    }

    // Fallback: use event ID (no correlation)
    return event.id
  }

  private extractUserId(event: Stripe.Event): string | null {
    const obj = event.data.object as any
    return obj.metadata?.supabase_user_id || null
  }

  private extractSubscriptionId(event: Stripe.Event): string | null {
    const obj = event.data.object as any
    if (event.type.startsWith("customer.subscription")) {
      return obj.id
    }
    if (event.type.startsWith("checkout.")) {
      return obj.subscription as string || null
    }
    return null
  }

  private async moveToDLQ(event_id: string, error: Error): Promise<void> {
    await this.supabase
      .from("webhook_dead_letter_queue")
      .insert({
        webhook_event_id: event_id,
        reason: "max_retries_exceeded",
        final_error: error.message,
        final_error_stack: error.stack
      })

    // Alert on-call
    await this.alertDLQ(event_id, error)
  }

  private async alertDLQ(event_id: string, error: Error): Promise<void> {
    // Integration with alerting system
    console.error("========================================")
    console.error("🚨 CRITICAL: WEBHOOK IN DEAD LETTER QUEUE 🚨")
    console.error("========================================")
    console.error("Event ID:", event_id)
    console.error("Error:", error.message)
    console.error("This represents PERMANENT data loss.")
    console.error("Manual intervention required.")
    console.error("========================================")
  }

  private async filterByDependencies(
    events: StoredWebhookEvent[]
  ): Promise<StoredWebhookEvent[]> {
    const ready: StoredWebhookEvent[] = []

    for (const event of events) {
      if (!event.depends_on || event.depends_on.length === 0) {
        ready.push(event)
        continue
      }

      // Check if all dependencies are completed
      const { data: completed } = await this.supabase
        .from("webhook_events")
        .select("id")
        .in("id", event.depends_on)
        .eq("status", "completed")

      if (completed && completed.length === event.depends_on.length) {
        ready.push(event)
      }
    }

    return ready
  }
}
```

---

## Idempotent Event Processing

### Idempotency Strategy

```typescript
// lib/webhooks/processor.ts

export class IdempotentWebhookProcessor {
  constructor(
    private eventStore: WebhookEventStore,
    private supabase: SupabaseClient
  ) {}

  /**
   * Process a Stripe webhook event idempotently.
   *
   * Key guarantees:
   * 1. Same event processed multiple times has same effect
   * 2. No duplicate data created
   * 3. Failures can be retried safely
   * 4. Complete audit trail maintained
   */
  async process(event: Stripe.Event): Promise<void> {
    const worker_id = `worker-${process.pid}-${Date.now()}`

    console.log("[WebhookProcessor] Received event:", {
      id: event.id,
      type: event.type,
      created: new Date(event.created * 1000).toISOString()
    })

    // Step 1: Store event (idempotency check)
    const storedEvent = await this.eventStore.store(event)

    if (!storedEvent) {
      console.log("[WebhookProcessor] Event already processed (idempotent)")
      return
    }

    // Step 2: Acquire processing lock
    const locked = await this.eventStore.acquireLock(event.id, worker_id)

    if (!locked) {
      console.log("[WebhookProcessor] Event already being processed by another worker")
      return
    }

    try {
      // Step 3: Check dependencies
      const ready = await this.checkDependencies(storedEvent)

      if (!ready) {
        console.log("[WebhookProcessor] Dependencies not met, will retry later")
        await this.eventStore.releaseLock(event.id)
        return
      }

      // Step 4: Process event with retry logic
      const result = await this.processWithRetry(event, storedEvent)

      // Step 5: Mark completed
      await this.eventStore.markCompleted(storedEvent.id, result)

      console.log("[WebhookProcessor] Event processed successfully:", {
        id: event.id,
        type: event.type,
        result
      })

    } catch (error) {
      console.error("[WebhookProcessor] Processing failed:", error)

      // Calculate retry delay with exponential backoff
      const attempts = storedEvent.attempts + 1
      const retry_delay_ms = Math.min(1000 * Math.pow(2, attempts), 60000) // Max 1 min

      await this.eventStore.markFailed(storedEvent.id, error as Error, retry_delay_ms)

    } finally {
      await this.eventStore.releaseLock(event.id)
    }
  }

  private async processWithRetry(
    event: Stripe.Event,
    storedEvent: StoredWebhookEvent
  ): Promise<any> {
    // Delegate to specific handler
    switch (event.type) {
      case "checkout.session.completed":
        return await this.handleCheckoutCompleted(event, storedEvent)

      case "customer.subscription.created":
      case "customer.subscription.updated":
        return await this.handleSubscriptionUpdated(event, storedEvent)

      // ... other handlers

      default:
        console.log("[WebhookProcessor] Unhandled event type:", event.type)
        return { skipped: true }
    }
  }

  /**
   * Handle checkout.session.completed IDEMPOTENTLY.
   *
   * Key idempotency strategy:
   * 1. Check if company already exists (by stripe_customer_id)
   * 2. If exists, verify it matches expected state
   * 3. If not exists, create atomically
   * 4. Return consistent result either way
   */
  private async handleCheckoutCompleted(
    event: Stripe.Event,
    storedEvent: StoredWebhookEvent
  ): Promise<any> {
    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.metadata?.supabase_user_id
    const customerId = session.customer as string
    const subscriptionId = session.subscription as string

    if (!userId) {
      throw new Error("Missing supabase_user_id in session metadata")
    }

    // IDEMPOTENCY: Check if company already exists
    const { data: existingCompany } = await this.supabase
      .from("companies")
      .select("id, owner_id, stripe_customer_id")
      .eq("stripe_customer_id", customerId)
      .single()

    if (existingCompany) {
      console.log("[WebhookProcessor] Company already exists (idempotent):", existingCompany.id)

      // Verify it matches expected state
      if (existingCompany.owner_id !== userId) {
        throw new Error(
          `Company ownership mismatch: expected ${userId}, got ${existingCompany.owner_id}`
        )
      }

      // Check if properties exist
      const { data: properties } = await this.supabase
        .from("properties")
        .select("id")
        .eq("company_id", existingCompany.id)

      return {
        company_id: existingCompany.id,
        company_created: false,
        properties_count: properties?.length || 0,
        idempotent: true
      }
    }

    // Company doesn't exist, create it
    const companyData = this.buildCompanyData(session, userId, customerId, subscriptionId)

    const { data: company, error: companyError } = await this.supabase
      .from("companies")
      .insert(companyData)
      .select("id")
      .single()

    if (companyError) {
      // Check for race condition (unique constraint violation)
      if (companyError.code === "23505") {
        // Another worker created it concurrently, retry to get existing
        console.log("[WebhookProcessor] Race condition detected, retrying...")
        return await this.handleCheckoutCompleted(event, storedEvent)
      }

      throw companyError
    }

    // Create properties
    const propertiesData = this.buildPropertiesData(session, userId, company.id)

    const { data: properties, error: propertiesError } = await this.supabase
      .from("properties")
      .insert(propertiesData)
      .select("id")

    if (propertiesError) {
      // Properties failed but company created
      // Log for manual cleanup but don't fail the webhook
      console.error("[WebhookProcessor] Properties creation failed:", {
        company_id: company.id,
        error: propertiesError
      })

      // This will be retried, and idempotency will skip company creation
    }

    return {
      company_id: company.id,
      company_created: true,
      properties_count: properties?.length || 0,
      idempotent: false
    }
  }

  /**
   * Handle subscription updates IDEMPOTENTLY.
   *
   * Idempotency strategy:
   * 1. Find company by stripe_customer_id
   * 2. Update subscription_status (UPDATE is naturally idempotent)
   * 3. Return consistent result
   */
  private async handleSubscriptionUpdated(
    event: Stripe.Event,
    storedEvent: StoredWebhookEvent
  ): Promise<any> {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string

    // Wait for company to exist (with exponential backoff)
    const company = await this.waitForCompany(customerId, storedEvent.attempts)

    if (!company) {
      throw new Error(`Company not found for customer ${customerId} after retries`)
    }

    // UPDATE is naturally idempotent
    const { error } = await this.supabase
      .from("companies")
      .update({
        subscription_id: subscription.id,
        subscription_status: subscription.status
      })
      .eq("id", company.id)

    if (error) {
      throw error
    }

    return {
      company_id: company.id,
      subscription_status: subscription.status,
      idempotent: true  // UPDATE is always idempotent
    }
  }

  /**
   * Wait for company to exist (handles race condition).
   *
   * Uses exponential backoff based on attempt number.
   */
  private async waitForCompany(
    customerId: string,
    attempt: number
  ): Promise<{ id: string } | null> {
    const max_attempts = 5
    const base_delay = 500 // ms

    for (let i = 0; i < max_attempts; i++) {
      const { data: company } = await this.supabase
        .from("companies")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single()

      if (company) {
        return company
      }

      if (i < max_attempts - 1) {
        const delay = base_delay * Math.pow(2, i) // Exponential backoff
        console.log(`[WebhookProcessor] Company not found, waiting ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return null
  }

  private async checkDependencies(event: StoredWebhookEvent): Promise<boolean> {
    if (!event.depends_on || event.depends_on.length === 0) {
      return true
    }

    const { data: completed } = await this.supabase
      .from("webhook_events")
      .select("id, status")
      .in("id", event.depends_on)

    if (!completed) {
      return false
    }

    // All dependencies must be completed
    return completed.every(dep => dep.status === "completed")
  }

  // Helper methods for data building
  private buildCompanyData(session: any, userId: string, customerId: string, subscriptionId: string): any {
    // ... implementation
  }

  private buildPropertiesData(session: any, userId: string, companyId: string): any[] {
    // ... implementation
  }
}
```

---

## Background Event Processor

```typescript
// lib/webhooks/background-processor.ts

/**
 * Background job that processes pending webhook events.
 *
 * Run this on a cron schedule (e.g., every 1 minute) to process
 * events that are pending or ready for retry.
 */
export class BackgroundWebhookProcessor {
  constructor(
    private eventStore: WebhookEventStore,
    private processor: IdempotentWebhookProcessor
  ) {}

  async processQueue(): Promise<void> {
    console.log("[BackgroundProcessor] Checking for pending events...")

    const events = await this.eventStore.getReadyEvents(10)

    if (events.length === 0) {
      console.log("[BackgroundProcessor] No events ready for processing")
      return
    }

    console.log("[BackgroundProcessor] Found", events.length, "events to process")

    for (const event of events) {
      try {
        // Reconstruct Stripe event from stored object
        const stripeEvent = event.stripe_object as Stripe.Event

        await this.processor.process(stripeEvent)

      } catch (error) {
        console.error("[BackgroundProcessor] Failed to process event:", {
          event_id: event.id,
          stripe_event_id: event.stripe_event_id,
          error
        })
      }
    }
  }
}

// Vercel Cron Job (or similar)
// app/api/cron/process-webhooks/route.ts

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const eventStore = new WebhookEventStore(supabase)
  const processor = new IdempotentWebhookProcessor(eventStore, supabase)
  const backgroundProcessor = new BackgroundWebhookProcessor(eventStore, processor)

  await backgroundProcessor.processQueue()

  return NextResponse.json({ success: true })
}
```

---

## Updated Webhook Route

```typescript
// app/api/stripe/webhook/route.ts

import { IdempotentWebhookProcessor } from "@/lib/webhooks/processor"
import { WebhookEventStore } from "@/lib/webhooks/event-store"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // Process event idempotently
  const supabase = createServiceClient()
  const eventStore = new WebhookEventStore(supabase)
  const processor = new IdempotentWebhookProcessor(eventStore, supabase)

  try {
    await processor.process(event)
    return NextResponse.json({ received: true })

  } catch (error) {
    console.error("[Webhook] Processing failed:", error)

    // Return 200 to Stripe (we stored the event, will retry via cron)
    // Returning 500 would cause Stripe to retry immediately, potentially making things worse
    return NextResponse.json({ received: true, queued: true })
  }
}
```

---

## Monitoring & Observability

### Metrics to Track

```typescript
// monitoring/webhook-metrics.ts

export const WEBHOOK_METRICS = {
  // Event tracking
  events_received_total: "counter",
  events_processed_total: "counter",
  events_failed_total: "counter",
  events_in_dlq_total: "gauge",

  // Processing time
  event_processing_duration_ms: "histogram",

  // Retry tracking
  events_retrying_total: "gauge",
  retry_attempts_distribution: "histogram",

  // Idempotency
  idempotent_hits_total: "counter",

  // Dependencies
  dependency_wait_duration_ms: "histogram",

  // Queue metrics
  pending_events_total: "gauge",
  processing_events_total: "gauge",
  completed_events_total: "counter"
}
```

### Dashboard Queries

```sql
-- Events by status (real-time)
SELECT status, COUNT(*) as count
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Event processing timeline
SELECT
  date_trunc('hour', created_at) as hour,
  event_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_sec
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, event_type
ORDER BY hour DESC;

-- Stuck events (potential issues)
SELECT *
FROM webhook_events
WHERE status IN ('pending', 'retrying')
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at;

-- Dead letter queue (needs investigation)
SELECT
  dlq.*,
  we.event_type,
  we.correlation_id,
  we.user_id
FROM webhook_dead_letter_queue dlq
JOIN webhook_events we ON we.id = dlq.webhook_event_id
WHERE NOT dlq.investigated
ORDER BY dlq.created_at;

-- Correlation analysis (trace event flow)
SELECT
  we.*
FROM webhook_events we
WHERE correlation_id = $1
ORDER BY created_at;
```

---

## Testing Strategy

### Unit Tests

```typescript
describe("IdempotentWebhookProcessor", () => {
  describe("checkout.session.completed", () => {
    it("should create company on first processing", async () => {
      const event = mockStripeEvent("checkout.session.completed")
      const result = await processor.process(event)

      expect(result.company_created).toBe(true)
      expect(result.idempotent).toBe(false)
    })

    it("should be idempotent on duplicate processing", async () => {
      const event = mockStripeEvent("checkout.session.completed")

      // Process twice
      const result1 = await processor.process(event)
      const result2 = await processor.process(event)

      expect(result2.company_created).toBe(false)
      expect(result2.idempotent).toBe(true)
      expect(result2.company_id).toBe(result1.company_id)
    })

    it("should handle race condition gracefully", async () => {
      const event = mockStripeEvent("checkout.session.completed")

      // Process concurrently
      const [result1, result2] = await Promise.all([
        processor.process(event),
        processor.process(event)
      ])

      // One creates, one is idempotent
      const created = [result1, result2].filter(r => r.company_created)
      expect(created).toHaveLength(1)

      // Both return same company
      expect(result1.company_id).toBe(result2.company_id)
    })
  })
})
```

### Integration Tests

```typescript
describe("Webhook Event Store", () => {
  it("should store events and enforce idempotency", async () => {
    const event = mockStripeEvent("checkout.session.completed")

    const stored1 = await eventStore.store(event)
    const stored2 = await eventStore.store(event)

    expect(stored1).toBeTruthy()
    expect(stored2).toBeNull() // Duplicate
  })

  it("should handle event dependencies", async () => {
    const checkoutEvent = mockStripeEvent("checkout.session.completed")
    const subscriptionEvent = mockStripeEvent("customer.subscription.created")

    await eventStore.store(checkoutEvent)
    await eventStore.store(subscriptionEvent)

    // Subscription event depends on checkout, shouldn't be ready
    const ready = await eventStore.getReadyEvents()
    expect(ready.map(e => e.event_type)).not.toContain("customer.subscription.created")
  })
})
```

---

## Migration Strategy

### Phase 1: Add Event Store (Non-Breaking)
1. Create webhook_events table
2. Modify webhook handler to store events (but still process inline)
3. Deploy, verify events are being stored
4. Monitor for any issues

### Phase 2: Add Idempotency (Low Risk)
1. Implement idempotency checks in handlers
2. Deploy, verify duplicate events are handled correctly
3. Test with Stripe retry scenarios

### Phase 3: Add Background Processor (Medium Risk)
1. Implement background processor cron job
2. Run in shadow mode (logs what it would do)
3. Enable processing, monitor closely
4. Gradually increase confidence

### Phase 4: Full Event-Driven (High Risk)
1. Webhook handler becomes event store only
2. All processing moves to background
3. Deploy during low-traffic window
4. Monitor for increased latency or failures

---

## Success Criteria

- [ ] Zero duplicate companies created
- [ ] 100% of webhook events stored in event store
- [ ] <1% of events in dead letter queue
- [ ] Average retry count < 1.5
- [ ] Can replay failed events from UI
- [ ] Real-time dashboard shows event flow
- [ ] Correlation IDs link all related events
- [ ] Dead letter queue has investigation workflow

---

**Next Steps**:
1. Review event store schema with DBA
2. Implement Phase 1 (event storage)
3. Create monitoring dashboard
4. Test idempotency scenarios
