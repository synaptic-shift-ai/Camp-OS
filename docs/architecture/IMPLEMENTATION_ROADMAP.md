# Implementation Roadmap - Post-Incident Recovery

**Document Version**: 1.0
**Created**: 2025-10-30
**Status**: APPROVED
**Target**: Complete by 2025-11-15 (2 weeks)

---

## Executive Summary

This roadmap implements architectural improvements to prevent recurrence of the October 30 conversion pipeline incident. Work is organized into three phases with clear priorities and risk levels.

**Total Estimated Effort**: 80-100 hours (~2 weeks for 1 engineer, 1 week for 2 engineers)

---

## Phase 1: CRITICAL SAFETY IMPROVEMENTS (This Week)

**Goal**: Add safety nets that would have prevented/detected the incident
**Timeline**: 5 business days
**Effort**: 40 hours
**Risk Level**: LOW (mostly additive)

### 1.1 Conversion Pipeline E2E Tests (HIGHEST PRIORITY)
**Effort**: 12 hours
**Owner**: Test Engineer
**Blocks**: All middleware/webhook changes

**Tasks**:
- [ ] Set up Playwright E2E test environment (2h)
- [ ] Create Stripe test mode fixtures (2h)
- [ ] Implement conversion pipeline E2E test (4h)
- [ ] Add redirect loop detection test (2h)
- [ ] Add wizard access regression test (2h)
- [ ] Integrate with CI/CD (GitHub Actions) (2h)

**Acceptance Criteria**:
- [ ] Test covers complete journey: checkout → webhook → wizard → dashboard
- [ ] Test detects redirect loops
- [ ] Test fails if wizard inaccessible
- [ ] Runs in <5 minutes
- [ ] Blocks PR merge if failing

**Files Created**:
- `tests/e2e/conversion-pipeline.spec.ts`
- `tests/e2e/helpers/stripe.ts`
- `.github/workflows/critical-path-tests.yml`

---

### 1.2 Redirect Loop Detection (Circuit Breaker)
**Effort**: 8 hours
**Owner**: Backend Engineer
**Risk**: LOW (fail-safe only)

**Tasks**:
- [ ] Implement RedirectLoopDetector class (3h)
- [ ] Add to middleware (1h)
- [ ] Add monitoring/alerting (2h)
- [ ] Write unit tests (2h)

**Acceptance Criteria**:
- [ ] Detects >3 redirects in 5 seconds
- [ ] Breaks loop and allows access
- [ ] Fires critical alert
- [ ] Logs correlation ID for debugging

**Files Modified**:
- `lib/middleware/loop-detector.ts` (new)
- `middleware.ts`

---

### 1.3 Critical Business Logic Documentation
**Effort**: 4 hours
**Owner**: Senior Engineer
**Risk**: ZERO (docs only)

**Tasks**:
- [ ] Add inline comments to middleware wizard logic (1h)
- [ ] Document webhook race condition handling (1h)
- [ ] Create Architecture Decision Record (ADR) (2h)

**Acceptance Criteria**:
- [ ] Every critical section has comment explaining WHY
- [ ] References incident document
- [ ] Lists tests that cover logic
- [ ] Warns against removal

**Files Modified**:
- `lib/supabase/middleware.ts`
- `app/api/stripe/webhook/route.ts`
- `docs/architecture/ADR-001-explicit-wizard-state.md` (new)

---

### 1.4 Properties API Contract Tests
**Effort**: 6 hours
**Owner**: Backend Engineer
**Risk**: LOW (tests only)

**Tasks**:
- [ ] Install Zod (5 min)
- [ ] Create PropertyListResponseSchema (1h)
- [ ] Add server-side validation (2h)
- [ ] Write integration tests (2h)
- [ ] Add to CI/CD (1h)

**Acceptance Criteria**:
- [ ] API validates response before returning
- [ ] Tests verify all required fields present
- [ ] Regression test for missing fields
- [ ] Validation failures trigger alerts

**Files Created**:
- `types/api/property.schema.ts`
- `tests/integration/properties-api.test.ts`

**Files Modified**:
- `app/api/onboarding/properties/route.ts`

---

### 1.5 Observability - Structured Logging
**Effort**: 10 hours
**Owner**: DevOps/Backend Engineer
**Risk**: LOW (additive)

**Tasks**:
- [ ] Create StructuredLogger class (3h)
- [ ] Add correlation IDs to middleware (2h)
- [ ] Integrate with monitoring service (3h)
- [ ] Add to critical paths (2h)

**Acceptance Criteria**:
- [ ] All logs include correlation_id, user_id, company_id
- [ ] Can trace user journey across services
- [ ] Logs sent to centralized service (Sentry/DataDog)
- [ ] Critical errors trigger alerts

**Files Created**:
- `lib/logger.ts`
- `lib/monitoring/sentry.ts`

**Files Modified**:
- `middleware.ts`
- `app/api/stripe/webhook/route.ts`

---

## Phase 2: RESILIENCE IMPROVEMENTS (Week 2)

**Goal**: Handle failures gracefully, add redundancy
**Timeline**: 5 business days
**Effort**: 30 hours
**Risk Level**: MEDIUM (changes behavior)

### 2.1 Webhook Event Store (Idempotency)
**Effort**: 16 hours
**Owner**: Backend Engineer
**Risk**: MEDIUM (database changes)

**Tasks**:
- [ ] Create webhook_events table schema (2h)
- [ ] Implement WebhookEventStore class (4h)
- [ ] Implement IdempotentWebhookProcessor (4h)
- [ ] Add retry logic with exponential backoff (2h)
- [ ] Write integration tests (3h)
- [ ] Deploy and monitor (1h)

**Acceptance Criteria**:
- [ ] All webhook events stored before processing
- [ ] Duplicate events detected and skipped
- [ ] Failed events retry automatically
- [ ] Dead letter queue for permanent failures
- [ ] Can replay events from UI

**Files Created**:
- `database/migrations/20251031_webhook_events.sql`
- `lib/webhooks/event-store.ts`
- `lib/webhooks/processor.ts`

---

### 2.2 API Error Boundaries
**Effort**: 6 hours
**Owner**: Frontend Engineer
**Risk**: LOW (UI only)

**Tasks**:
- [ ] Create ApiErrorBoundary component (2h)
- [ ] Add to critical routes (1h)
- [ ] Create user-friendly error UI (2h)
- [ ] Write component tests (1h)

**Acceptance Criteria**:
- [ ] Catches API validation errors
- [ ] Shows user-friendly message
- [ ] Provides retry/support options
- [ ] Logs error details

**Files Created**:
- `components/error-boundaries/api-error-boundary.tsx`

---

### 2.3 Background Webhook Processor
**Effort**: 8 hours
**Owner**: Backend Engineer
**Risk**: MEDIUM (new service)

**Tasks**:
- [ ] Implement BackgroundWebhookProcessor (3h)
- [ ] Create cron endpoint (2h)
- [ ] Set up Vercel cron job (1h)
- [ ] Add monitoring (2h)

**Acceptance Criteria**:
- [ ] Processes pending events every minute
- [ ] Respects event dependencies
- [ ] Handles retries automatically
- [ ] Alerts on persistent failures

**Files Created**:
- `lib/webhooks/background-processor.ts`
- `app/api/cron/process-webhooks/route.ts`
- `vercel.json` (add cron config)

---

## Phase 3: LONG-TERM IMPROVEMENTS (Week 3-4)

**Goal**: State machine architecture, comprehensive monitoring
**Timeline**: 10 business days
**Effort**: 30 hours
**Risk Level**: HIGH (architectural changes)

### 3.1 Middleware State Machine
**Effort**: 20 hours
**Owner**: Senior Engineer
**Risk**: HIGH (core logic change)

**Strategy**: Phased rollout with shadow mode

**Tasks**:
- [ ] Define UserState type and route configs (4h)
- [ ] Implement resolveUserState function (3h)
- [ ] Run in shadow mode (compare with current) (2h)
- [ ] Write comprehensive tests (4h)
- [ ] Deploy to staging (2h)
- [ ] Gradual cutover in production (3h)
- [ ] Remove old logic after 1 week (2h)

**Acceptance Criteria**:
- [ ] State transitions explicit and documented
- [ ] Type-safe route configuration
- [ ] 100% parity with current behavior
- [ ] Zero regressions in E2E tests
- [ ] Performance within 10ms of current

---

### 3.2 Real-Time Monitoring Dashboard
**Effort**: 10 hours
**Owner**: DevOps Engineer
**Risk**: LOW (observability only)

**Tasks**:
- [ ] Set up monitoring service (DataDog/Grafana) (3h)
- [ ] Create conversion funnel dashboard (3h)
- [ ] Create performance dashboard (2h)
- [ ] Set up alerts (2h)

**Acceptance Criteria**:
- [ ] Real-time conversion funnel visualization
- [ ] Drop-off rates visible
- [ ] Alerts for anomalies
- [ ] Accessible to product team

---

## Risk Mitigation

### High-Risk Changes

1. **Webhook Event Store**:
   - Deploy in shadow mode first
   - Compare results with current implementation
   - Gradual rollout: 10% → 50% → 100%
   - Rollback plan: Remove event store, keep old handlers

2. **Middleware State Machine**:
   - Run in parallel with current logic
   - Log discrepancies
   - Fix mismatches before cutover
   - Rollback: Revert to commit before change

### Rollback Procedures

```bash
# Quick rollback procedure
git revert HEAD
git push origin main

# Or use Vercel instant rollback
vercel rollback
```

---

## Dependencies

### External Services Needed

- [ ] Sentry account (or equivalent monitoring)
- [ ] Vercel cron jobs enabled
- [ ] Stripe test mode configured
- [ ] Playwright CI/CD runner

### Team Coordination

- **Week 1**: Daily standups to track Phase 1
- **Week 2**: Code reviews for all webhook changes
- **Week 3**: Pair programming for state machine
- **After each phase**: Retrospective and lessons learned

---

## Success Metrics

### Phase 1 Success Criteria
- [ ] Conversion pipeline E2E test passes
- [ ] Zero redirect loops in production (1 week)
- [ ] 100% of critical paths documented
- [ ] Mean time to detection < 5 minutes

### Phase 2 Success Criteria
- [ ] Zero duplicate webhook data created
- [ ] <1% of webhooks in dead letter queue
- [ ] API validation errors caught before production
- [ ] User-facing error messages improved

### Phase 3 Success Criteria
- [ ] State machine deployed with zero regressions
- [ ] Real-time dashboard operational
- [ ] Mean time to resolution < 30 minutes
- [ ] Zero conversion pipeline incidents (30 days)

---

## Timeline Gantt Chart

```
Week 1 (CRITICAL)
Mon: E2E tests + Loop detector
Tue: E2E tests + Documentation
Wed: Contract tests + Logging
Thu: Logging + Testing
Fri: Deploy Phase 1, monitor

Week 2 (RESILIENCE)
Mon: Event store schema + Processor
Tue: Event store + Background processor
Wed: Background processor + Error boundaries
Thu: Testing + Integration
Fri: Deploy Phase 2, monitor

Week 3-4 (ARCHITECTURE)
Week 3: State machine implementation + testing
Week 4: Dashboard + final deployment
```

---

## Next Steps

1. **Immediate** (Today):
   - Review roadmap with team
   - Assign owners to Phase 1 tasks
   - Set up project board

2. **This Week** (Phase 1):
   - Start E2E tests (parallel with other work)
   - Add loop detector
   - Document critical logic

3. **Next Week** (Phase 2):
   - Begin event store implementation
   - Add error boundaries

4. **Week 3-4** (Phase 3):
   - State machine rollout
   - Monitoring dashboard

---

**Related Documents**:
- [Middleware Architecture](./MIDDLEWARE_ARCHITECTURE.md)
- [Webhook Resilience](./WEBHOOK_RESILIENCE_ARCHITECTURE.md)
- [Testing Requirements](./TESTING_REQUIREMENTS.md)
- [Observability Strategy](./OBSERVABILITY_STRATEGY.md)
