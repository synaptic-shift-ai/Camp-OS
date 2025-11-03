# Middleware Hardening - PRD

**Linear Issue:** [CAM-129](https://linear.app/campgroundops/issue/CAM-129/critical-bug-middleware-hardening)
**Version:** 1.0
**Date:** 2025-10-31
**Status:** Draft
**Priority:** Urgent
**Author:** Product Owner (AI Agent)

---

## 1. Executive Summary

### 1.1. Problem Statement

On October 30, 2025, a critical production incident occurred where middleware refactoring accidentally removed wizard access logic, causing an infinite redirect loop that broke the entire conversion pipeline during a live demo. Users completing Stripe checkout could not access the onboarding wizard, resulting in 100% conversion failure.

**Root Cause:** Business-critical logic (wizard access exception) was implicit in conditional structure, making it easy to accidentally remove during refactoring. No type safety, automated tests, or fail-safes existed to prevent or detect this failure.

**Evidence:**
- Commit `d078412` refactored subscription logic correctly but removed wizard access check
- Three emergency fixes deployed same night (`819753f`, `c24735a`, `184f6fd`)
- Complete conversion pipeline failure during investor demo
- Zero automated tests caught the regression

### 1.2. Proposed Solution

Redesign middleware architecture to make critical business logic explicit, type-safe, and resilient to refactoring. Implement a state machine-based approach with redirect loop detection, comprehensive logging, and circuit breakers to prevent similar incidents.

**Key Improvements:**
1. **Explicit State Machine:** Replace ad-hoc conditionals with named user states (e.g., "in_wizard")
2. **Type-Safe Route Configuration:** Breaking changes cause TypeScript build errors
3. **Redirect Loop Detection:** Circuit breaker prevents infinite loops
4. **Comprehensive Testing:** E2E tests for entire conversion pipeline
5. **Fail-Safe Mechanisms:** Escape hatches for stuck users
6. **Observable:** Real-time logging and alerting

### 1.3. Business Goals

- **Prevent Revenue Loss:** Never repeat 100% conversion failure
- **Increase Developer Velocity:** Clear architecture reduces refactoring risk
- **Improve Reliability:** 99.9% uptime for conversion pipeline
- **Reduce Support Burden:** No users stuck in redirect loops
- **Build Trust:** Demonstrate engineering excellence to investors

---

## 2. Business Value

### 2.1. Problem Impact

**Direct Business Impact:**
- **Revenue at Risk:** Every minute of conversion failure = lost customers
- **Investor Confidence:** Production failures during demos damage credibility
- **Support Burden:** Manual intervention required to unstick users
- **Developer Time:** Emergency fixes and incident response cost 4+ engineering hours

**Technical Debt Impact:**
- **Fragile Codebase:** Implicit business logic easily broken
- **Fear of Refactoring:** Engineers avoid middleware changes due to risk
- **Knowledge Silos:** Only one person understands wizard access logic
- **Testing Gap:** No E2E coverage of conversion pipeline

**User Experience Impact:**
- **Frustrated Customers:** Users who pay can't access product
- **Churn Risk:** Failed onboarding leads to refund requests
- **Brand Damage:** "Broken" experience erodes trust

### 2.2. Opportunity

**Immediate Benefits:**
- **Zero Conversion Failures:** Circuit breakers prevent infinite loops
- **Faster Refactoring:** Type-safe config catches breaking changes at build time
- **Reduced Incidents:** Comprehensive E2E tests catch regressions in CI
- **Clear Ownership:** Documented architecture enables team scale

**Long-Term Benefits:**
- **Competitive Advantage:** Reliable conversion pipeline drives growth
- **Engineering Velocity:** Confidence to refactor enables faster feature delivery
- **Operational Excellence:** Real-time monitoring detects issues before users report them
- **Investor Confidence:** Production stability demonstrates technical maturity

### 2.3. Strategic Alignment

Aligns with CampOps platform goals:
- **Reliability:** Multi-tenant SaaS requires 99.9% uptime
- **Scalability:** Explicit architecture supports team growth
- **Security:** Type-safe routing prevents accidental permission bypasses
- **Developer Experience:** Clear patterns reduce onboarding time

---

## 3. User Stories

### 3.1. Primary Users

**Property Operators (New Customers)**
- Need: Complete onboarding without technical issues
- Pain: Infinite redirect loops block access to paid product
- Benefit: Seamless transition from payment to wizard

**Engineering Team**
- Need: Refactor middleware safely
- Pain: Fragile implicit logic causes production incidents
- Benefit: Type-safe architecture catches breaking changes early

**Support Team**
- Need: Help stuck users quickly
- Pain: No tools to diagnose or fix redirect loops
- Benefit: Circuit breakers and escape hatches reduce manual intervention

### 3.2. User Stories

**As a new property operator**, I want to complete onboarding after payment **so that** I can start using CampOps immediately without encountering technical errors.

**Acceptance Criteria:**
- Complete Stripe checkout successfully
- Redirect to wizard within 5 seconds
- Access wizard UI without redirect loops
- Complete wizard steps without interruption
- Dashboard access granted after wizard completion

**As an engineer**, I want to refactor middleware safely **so that** I can improve architecture without breaking critical user flows.

**Acceptance Criteria:**
- Type errors if I remove required route configurations
- E2E tests fail in CI if conversion pipeline breaks
- Clear documentation explains WHY each logic block exists
- Can run middleware changes in shadow mode before cutover

**As a support engineer**, I want to detect and resolve redirect loops automatically **so that** users never get stuck and require manual intervention.

**Acceptance Criteria:**
- Circuit breaker triggers after 3 redirects within 5 seconds
- User sees helpful error message (not infinite loading)
- Logs contain full context for debugging
- Alert fires in Slack/email when loop detected
- Admin dashboard shows redirect loop history

**As a DevOps engineer**, I want to monitor middleware health in real-time **so that** I can detect and resolve issues before customers are impacted.

**Acceptance Criteria:**
- Dashboard shows user state distribution (pie chart)
- Redirect patterns visualized (Sankey diagram)
- Alerts fire when redirect rate exceeds threshold
- Latency metrics tracked (p50, p95, p99)
- Can trace individual user journeys through logs

### 3.3. User Scenarios

#### Scenario 1: New Customer Happy Path

1. **User** completes Stripe checkout for Starter plan
2. **Webhook** creates company record with `subscription_status = "active"`
3. **Webhook** creates property record with `onboarding_completed = false`
4. **Webhook** redirects to `/dashboard/sites?wizard=true`
5. **Middleware** resolves user state as "in_wizard"
6. **Middleware** allows access to dashboard (wizard exception)
7. **User** sees wizard UI and completes setup steps
8. **User** finishes wizard, `onboarding_completed` set to `true`
9. **Middleware** resolves state as "full_access"
10. **User** accesses full dashboard

**Current Problem:** Step 5-6 fail if wizard logic accidentally removed.

**Solution:** Explicit `in_wizard` state in type-safe configuration prevents removal.

#### Scenario 2: Engineer Refactors Subscription Logic

1. **Engineer** changes subscription check logic in middleware
2. **Engineer** accidentally removes `isInWizard` conditional
3. **TypeScript compiler** throws error: "Route config missing wizard state"
4. **Engineer** sees error, realizes mistake, preserves wizard logic
5. **Code** doesn't compile until fixed
6. **CI/CD** blocks deploy

**Current Problem:** No build-time protection, mistake reaches production.

**Solution:** Type-safe route configuration catches breaking changes at compile time.

#### Scenario 3: Redirect Loop Detection

1. **User** encounters misconfigured middleware
2. **Middleware** redirects `/dashboard?wizard=true` → `/onboarding`
3. **Onboarding page** redirects back to `/dashboard?wizard=true`
4. **Loop detector** increments counter (3 redirects in 2 seconds)
5. **Circuit breaker** triggers, blocks redirect
6. **User** sees error: "We detected a configuration issue. Support has been notified."
7. **Alert** fires in Slack: "CRITICAL: Redirect loop detected"
8. **Engineer** investigates logs, fixes config
9. **User** can retry with fixed config

**Current Problem:** Infinite loops break browser, user stuck forever.

**Solution:** Circuit breaker detects loops and provides escape hatch.

---

## 4. Functional Requirements

### 4.1. Core Requirements

#### FR-1: Explicit User State Machine

**Requirement:** Define all possible user states explicitly with named constants.

**User States:**
- `anonymous` - Not logged in
- `authenticated` - Logged in but email not verified
- `email_unverified` - Email not confirmed
- `email_verified` - Email confirmed
- `no_subscription` - No company or inactive subscription
- `has_subscription` - Active subscription exists
- `onboarding_incomplete` - Properties need setup
- `in_wizard` - Actively completing wizard (CRITICAL STATE)
- `onboarding_complete` - All properties configured
- `full_access` - Complete access to all features

**Acceptance Criteria:**
- States defined in TypeScript enum/union type
- Each state has clear documentation
- State transitions documented in diagram
- `in_wizard` state explicitly prevents onboarding redirects

#### FR-2: Type-Safe Route Configuration

**Requirement:** All routes must have explicit access rules defined in typed configuration.

**Configuration Structure:**
```typescript
type RouteConfig = {
  path: string
  requiresAuth: boolean
  requiresEmailVerification: boolean
  requiresSubscription: boolean
  requiresOnboardingComplete: boolean
  allowInWizard: boolean  // EXPLICIT FLAG
  accessRules: Record<UserState, RouteAccess>
}
```

**Acceptance Criteria:**
- TypeScript enforces configuration for all protected routes
- Removing `allowInWizard` flag causes build error
- Route configs validated at build time
- Missing access rules for any state cause compile error
- Configuration self-documenting via types

#### FR-3: Redirect Loop Detection

**Requirement:** Detect and prevent infinite redirect loops automatically.

**Mechanism:**
- Track redirect count via short-lived cookie
- Max 3 redirects within 5 seconds
- Reset counter after 5 seconds of no redirects
- Trigger circuit breaker on threshold

**Acceptance Criteria:**
- Circuit breaker blocks redirect after 3 loops
- User sees helpful error message (not infinite loading)
- Logs contain full redirect history
- Alert fires when loop detected
- Counter resets on successful page load

#### FR-4: State Resolution Logic

**Requirement:** Calculate user state based on context in predictable order.

**Resolution Order:**
1. Check authentication (user exists?)
2. Check email verification
3. Check subscription status
4. **Check wizard state (BEFORE onboarding check)**
5. Check onboarding completion
6. Return final state

**Acceptance Criteria:**
- State resolver is pure function (testable)
- Order of checks clearly documented with comments
- `isInWizard` check happens BEFORE `hasIncompleteProperties`
- Unit tests cover all state transitions
- State resolver never throws exceptions

#### FR-5: Comprehensive Logging

**Requirement:** Log every middleware decision with full context.

**Logged Information:**
- Request path and query params
- Resolved user state
- Route configuration matched
- Access decision (allow/deny)
- Redirect target (if any)
- Execution time
- User ID (if authenticated)

**Acceptance Criteria:**
- Every middleware execution produces structured log
- Logs include unique request ID for tracing
- Sensitive data (passwords, tokens) never logged
- Log level configurable (debug vs production)
- Logs searchable by user ID, path, state

#### FR-6: Fail-Safe Mechanisms

**Requirement:** Provide escape hatches when middleware fails.

**Mechanisms:**
1. **Loop Detection:** Break loop and allow access (logged)
2. **Database Errors:** Allow access with warning (fail open)
3. **Timeout:** Skip onboarding check if query too slow
4. **Manual Override:** Admin can bypass checks via special header

**Acceptance Criteria:**
- Users never permanently stuck
- All fail-safe triggers logged and alerted
- Manual override requires admin authentication
- Fail-safe usage tracked in metrics

### 4.2. Edge Cases

#### EC-1: Same-Path Redirect

**Scenario:** Middleware redirects to same path user already on.

**Handling:** Detect and log as potential bug, allow access.

#### EC-2: Multi-Tab Concurrency

**Scenario:** User opens multiple tabs, redirect counter shared.

**Handling:** Counter scoped to request path, not global.

#### EC-3: Database Latency Spike

**Scenario:** Subscription query takes >2 seconds.

**Handling:** Skip onboarding check (fail open), log timeout.

#### EC-4: Malformed Query Params

**Scenario:** `wizard=` (empty value) or `wizard=yes` (not "true").

**Handling:** Only `wizard=true` sets `isInWizard` flag.

### 4.3. Multi-Tenant Considerations

**Tenant Isolation:**
- All database queries include `company_id` or `owner_id` filter
- Route configs never expose cross-tenant data
- Redirect targets never leak tenant information
- Logs include tenant ID for security audits

**Per-Tenant Configuration:**
- Future: Allow custom onboarding flows per tenant
- Route configs extensible to support tenant overrides

### 4.4. Security & Compliance

**Security Requirements:**
- No sensitive data in URL query params
- Redirect targets validated (no open redirect vulnerability)
- Rate limiting on authentication attempts
- Session hijacking prevention (check session age)

**Compliance:**
- GDPR: User state transitions logged for data subject requests
- CCPA: No personal data in client-side state (cookies)
- SOC 2: Audit trail of all access decisions

---

## 5. Non-Functional Requirements

### 5.1. Performance

**Target Metrics:**
- Middleware latency p99 < 100ms
- State resolution < 10ms (in-memory logic)
- Database queries < 50ms (indexed lookups)
- No blocking operations (async everywhere)

**Acceptance Criteria:**
- Load test: 1000 concurrent requests without degradation
- No N+1 query patterns
- Database indexes on `owner_id`, `company_id`, `onboarding_completed`

### 5.2. Reliability

**Target Metrics:**
- 99.9% uptime for conversion pipeline
- Zero infinite redirect loops in production
- < 1 minute MTTR (mean time to recovery) for middleware issues

**Acceptance Criteria:**
- Circuit breaker prevents catastrophic failures
- Graceful degradation on database errors
- Health check endpoint for load balancer

### 5.3. Observability

**Target Metrics:**
- 100% of middleware decisions logged
- Logs searchable within 10 seconds
- Dashboards update in real-time
- Alerts fire within 1 minute of issue

**Acceptance Criteria:**
- Structured JSON logs
- Tracing integration (OpenTelemetry)
- Custom dashboards in monitoring tool
- Alert integration with Slack/PagerDuty

### 5.4. Maintainability

**Target Metrics:**
- New engineer can understand middleware in < 30 minutes
- Zero implicit business logic (all explicit)
- 100% documentation coverage of critical paths

**Acceptance Criteria:**
- Architecture Decision Record (ADR) written
- Inline comments explain WHY, not WHAT
- State machine diagram in docs
- Runbook for incident response

---

## 6. Technical Implementation Notes

### 6.1. Architecture Overview

**Current (Fragile):**
```
Request → Single middleware function with nested conditionals → Response
```

**Proposed (Resilient):**
```
Request → State Resolver → Route Matcher → Access Checker → Loop Detector → Response
                ↓                                                    ↓
          Supabase DB                                         Logging/Alerts
```

### 6.2. Migration Strategy

**Phase 1: Observability (Week 1)**
- Add comprehensive logging to existing middleware
- Deploy to production, collect baseline metrics
- NO BEHAVIOR CHANGES

**Phase 2: Loop Detection (Week 2)**
- Implement loop detector in logging mode (don't block)
- Tune thresholds based on production data
- Enable circuit breaker

**Phase 3: State Resolver (Week 3)**
- Extract state resolution to pure function
- Run in shadow mode (compare with existing logic)
- Switch over once results match 100%

**Phase 4: Route Configuration (Week 4)**
- Define typed route configs
- Run in shadow mode alongside existing logic
- Switch over, remove old conditionals

**Phase 5: Full Cutover (Week 5)**
- Deploy to staging, run full E2E suite
- Canary deploy to 10% production traffic
- Monitor for 24 hours, roll out to 100%

### 6.3. Files to Create/Modify

**New Files:**
- `lib/middleware/state-resolver.ts` - Pure state calculation logic
- `lib/middleware/route-config.ts` - Type-safe route definitions
- `lib/middleware/loop-detector.ts` - Circuit breaker logic
- `lib/middleware/types.ts` - Shared TypeScript types
- `tests/integration/middleware.test.ts` - Integration tests
- `tests/e2e/conversion-pipeline.spec.ts` - E2E tests
- `docs/architecture/MIDDLEWARE_ARCHITECTURE.md` - Already exists, update
- `docs/architecture/ADR-001-explicit-wizard-state.md` - Architecture decision

**Modified Files:**
- `lib/supabase/middleware.ts` - Refactor to use new components
- `middleware.ts` - Update to call new architecture

### 6.4. Testing Strategy

**Unit Tests (Vitest):**
- State resolver: All state transitions
- Route config: Type safety validation
- Loop detector: Counter logic, threshold detection

**Integration Tests:**
- Full middleware flow with test database
- Tenant isolation verification
- Database error handling

**E2E Tests (Playwright):**
- Complete conversion pipeline (checkout → wizard → dashboard)
- Redirect loop detection
- All user states and transitions

**Performance Tests:**
- Load test with 1000 concurrent requests
- Database query performance
- Memory leak detection

**Security Tests (MUST per CLAUDE.md T-7):**
- Tenant isolation: User A cannot access User B's data
- Open redirect prevention
- Session hijacking prevention

### 6.5. Monitoring & Alerting

**Metrics to Track:**
- Middleware latency (p50, p95, p99)
- Redirect rate (% of requests redirected)
- Loop detection rate (times circuit breaker triggered)
- User state distribution (histogram)
- Error rate by user state

**Critical Alerts:**
- `REDIRECT_LOOP_DETECTED` - Immediate page
- `HIGH_REDIRECT_RATE` - Warning (>50% for 5 min)
- `MIDDLEWARE_LATENCY_HIGH` - Warning (p99 > 500ms)
- `WIZARD_ACCESS_BLOCKED` - Critical (conversion pipeline broken)

**Dashboard Widgets:**
- User state distribution (pie chart)
- Redirect flow (Sankey diagram)
- Middleware latency over time (line chart)
- Error rate by state (bar chart)

---

## 7. Success Metrics

### 7.1. Engineering Metrics

**Type Safety:**
- Target: 100% of route configs typed
- Measure: TypeScript compilation enforces configs
- Success: Removing wizard logic causes build error

**Test Coverage:**
- Target: 100% coverage of conversion pipeline
- Measure: E2E tests for checkout → wizard → dashboard
- Success: Regression tests fail before reaching production

**Incident Reduction:**
- Target: Zero redirect loop incidents
- Measure: Production incident count
- Success: Circuit breaker prevents all infinite loops

### 7.2. Business Metrics

**Conversion Rate:**
- Target: 0% conversion failures (from 100% failure during incident)
- Measure: Stripe checkout → wizard access success rate
- Success: 7 days with zero conversion pipeline errors

**Developer Velocity:**
- Target: 50% reduction in middleware change fear
- Measure: Time to deploy middleware changes (with confidence)
- Success: Engineers refactor without manual testing

**Support Burden:**
- Target: Zero support tickets for redirect loops
- Measure: Support ticket volume
- Success: No manual intervention required for stuck users

### 7.3. Operational Metrics

**Reliability:**
- Target: 99.9% uptime for conversion pipeline
- Measure: Monitoring uptime
- Success: No conversion failures for 30 days

**Observability:**
- Target: Mean time to detection (MTTD) < 1 minute
- Measure: Time from issue to alert
- Success: Alerts fire before users report issues

**Recovery:**
- Target: Mean time to recovery (MTTR) < 5 minutes
- Measure: Time from alert to resolution
- Success: Circuit breaker auto-recovers

---

## 8. Dependencies & Risks

### 8.1. Technical Dependencies

**Prerequisites:**
- TypeScript 5.0+ (branded types support)
- Next.js middleware API stable
- Supabase connection pooling configured
- Monitoring tool integration (Sentry, DataDog, or similar)

**External Services:**
- Supabase database (companies, properties tables)
- Stripe webhook integration
- Email service (verification flow)

### 8.2. Assumptions

- Middleware refactors complete before next investor demo (2 weeks)
- No breaking changes to Next.js middleware API in next release
- Database performance remains stable under load
- Team has capacity for 5-week phased rollout

### 8.3. Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-------------|------------|
| New architecture introduces new bugs | High | Medium | Shadow mode testing, canary deploys, instant rollback plan |
| Migration takes longer than 5 weeks | Medium | Medium | Start with high-value phases (observability, loop detection) |
| Performance regression from extra logging | Medium | Low | Async logging, sampling in production, load testing |
| Type system complexity slows development | Low | Low | Clear documentation, examples, team training |
| Circuit breaker has false positives | High | Low | Tune thresholds in production with shadow mode first |

### 8.4. Open Questions

1. **Should we implement A/B testing for new middleware?** (Roll out to 10% traffic first?)
2. **What monitoring tool should we use?** (Sentry, DataDog, New Relic?)
3. **Should we add admin dashboard for middleware debugging?** (View user state, override redirects?)
4. **How do we handle backwards compatibility during migration?** (Feature flag old vs new?)
5. **Should we build CLI tool for testing route configs locally?** (Dev experience improvement?)

---

## 9. Out of Scope (Future Enhancements)

**Phase 2 Enhancements:**
- Per-tenant custom onboarding flows
- A/B testing different wizard UIs
- Progressive onboarding (partial access while incomplete)
- Admin dashboard for middleware debugging
- Real-time user journey visualization

**Advanced Features:**
- Machine learning for fraud detection in middleware
- Geographic routing logic (different flows by region)
- Feature flags per user state
- Time-based access rules (maintenance windows)

---

## 10. Testing Requirements

### 10.1. Unit Tests (MUST per CLAUDE.md T-1)

**Location:** Colocated with source files

**Coverage:**
- `state-resolver.test.ts`:
  - All state transitions (parameterized tests)
  - Edge cases (null values, undefined properties)
  - Wizard state takes precedence over incomplete onboarding
- `loop-detector.test.ts`:
  - Counter increment/decrement
  - Threshold detection
  - Timer reset logic
- `route-config.test.ts`:
  - Type validation
  - Access rule completeness

**Best Practice Adherence:**
- MUST follow T-6 (test entire structure in one assertion)
- MUST follow T-9 (no hardcoded temporal data)
- SHOULD follow T-10 (use test data factories)
- SHOULD follow T-11 (parameterize edge cases with `test.each()`)

### 10.2. Integration Tests (MUST per CLAUDE.md T-2, T-4)

**Location:** `tests/integration/middleware.test.ts`

**Coverage:**
- Full middleware flow with real Supabase test database
- Wizard access with incomplete onboarding (CRITICAL PATH)
- Redirect loop prevention
- Database error handling (fail-safe behavior)
- Tenant isolation (MUST per T-7)

**Best Practice Adherence:**
- MUST be separate from unit tests (T-3)
- SHOULD prefer integration tests over mocking (T-4)

### 10.3. Security Tests (MUST per CLAUDE.md T-7)

**Location:** `tests/security/middleware-isolation.test.ts`

**Coverage:**
- Tenant A cannot access Tenant B's wizard
- Database queries include proper tenant filters
- Redirect targets never leak tenant information
- Session hijacking prevention

### 10.4. E2E Tests (MUST per CLAUDE.md)

**Location:** `tests/e2e/conversion-pipeline.spec.ts`

**Coverage:**
- Complete happy path: Stripe checkout → webhook → wizard → dashboard
- Redirect loop detection (verify circuit breaker fires)
- Error recovery (user fixes issue and retries)
- Mobile responsiveness

**Best Practice Adherence:**
- MUST use Testing Library queries (T-8)
- MUST test realistic user scenarios, not just technical paths

### 10.5. Performance Tests

**Location:** `tests/performance/middleware-load.test.ts`

**Coverage:**
- 1000 concurrent requests
- Database query performance
- Memory leak detection
- Latency under load

---

## 11. Documentation Requirements

### 11.1. Inline Code Comments (CRITICAL)

**Example:**
```typescript
// CRITICAL BUSINESS LOGIC - DO NOT REMOVE
//
// This check allows users to access the dashboard while in the onboarding wizard.
// The wizard UI is located at /dashboard/sites?wizard=true, so users with
// incomplete onboarding MUST be allowed to access dashboard routes when the
// wizard parameter is present.
//
// INCIDENT REFERENCE: 2025-10-30 (CAM-129) - Removing this check caused an
// infinite redirect loop that broke the entire conversion pipeline during a
// live investor demo. Users would be redirected from /dashboard?wizard=true
// → /onboarding → /dashboard?wizard=true in an infinite loop.
//
// TESTING:
// - Unit: lib/middleware/__tests__/state-resolver.test.ts
// - Integration: tests/integration/middleware.test.ts
// - E2E: tests/e2e/conversion-pipeline.spec.ts
//
// BEFORE MODIFYING:
// 1. Read docs/architecture/MIDDLEWARE_ARCHITECTURE.md
// 2. Read docs/architecture/ADR-001-explicit-wizard-state.md
// 3. Ensure E2E tests still pass: npm run test:e2e
// 4. Manual test: Complete Stripe checkout → verify wizard loads
// 5. Check for redirect loops in browser DevTools Network tab
//
if (context.isInWizard) {
  return "in_wizard"
}
```

### 11.2. Architecture Decision Record

**File:** `docs/architecture/ADR-001-explicit-wizard-state.md`

**Sections:**
- Status: ACCEPTED
- Context: Oct 30 incident summary
- Decision: Explicit "in_wizard" state with type safety
- Consequences: Positive, negative, risks
- Alternatives considered

### 11.3. Runbook

**File:** `docs/runbooks/MIDDLEWARE_INCIDENTS.md`

**Sections:**
- Symptoms of redirect loop
- How to check circuit breaker logs
- How to manually unstick a user
- How to rollback middleware changes
- Post-incident review checklist

---

## 12. Appendix

### 12.1. Glossary

- **Wizard:** Interactive onboarding UI at `/dashboard/sites?wizard=true`
- **Conversion Pipeline:** Stripe checkout → webhook → wizard → dashboard flow
- **Circuit Breaker:** Fail-safe mechanism that stops infinite loops
- **User State:** Discrete categorization of user permissions (e.g., "in_wizard")
- **Route Config:** Type-safe definition of access rules per route
- **Shadow Mode:** Running new logic alongside old logic to compare results

### 12.2. References

- **Incident Report:** `docs/reference/INCIDENT_SUMMARY_2025_10_30.md`
- **Architecture Proposal:** `docs/architecture/MIDDLEWARE_ARCHITECTURE.md`
- **Conversion Flow:** `docs/reference/CONVERSION_PIPELINE_FLOW.md` (if exists)
- **Testing Guidelines:** `.claude/testing-guidelines.md`
- **CLAUDE.md:** Implementation Best Practices (Section 1-7)

### 12.3. Related Linear Issues

- CAM-129 (this PRD) - Middleware hardening
- CAM-78 - Property CSV upload (reference for PRD structure)
- Related incidents in Linear "Bug" label

### 12.4. State Machine Diagram

See `docs/architecture/MIDDLEWARE_ARCHITECTURE.md` for full Mermaid diagram.

**Key States:**
1. Anonymous → Authenticated → Email Verified
2. Email Verified → Has Subscription
3. Has Subscription → **In Wizard** (CRITICAL)
4. In Wizard → Onboarding Complete
5. Onboarding Complete → Full Access

**Critical Transition:**
`Has Subscription + wizard=true` → `In Wizard` (allows dashboard access)

---

## 13. Acceptance Criteria (Definition of Done)

This PRD is considered complete when:

**Engineering:**
- [ ] Type-safe route configuration implemented and enforced
- [ ] State resolver extracted as pure function
- [ ] Redirect loop detector with circuit breaker deployed
- [ ] Comprehensive logging added to all middleware decisions
- [ ] All unit tests passing (100% coverage of state transitions)
- [ ] All integration tests passing (tenant isolation verified)
- [ ] All E2E tests passing (conversion pipeline end-to-end)
- [ ] Performance tests pass (p99 < 100ms)

**Documentation:**
- [ ] Inline comments added to all critical logic with incident references
- [ ] Architecture Decision Record (ADR) written and reviewed
- [ ] State machine diagram created and published
- [ ] Runbook created for incident response
- [ ] MIDDLEWARE_ARCHITECTURE.md updated with implementation details

**Deployment:**
- [ ] Phase 1-5 migration completed successfully
- [ ] Canary deploy to 10% traffic with zero issues
- [ ] Full production rollout with monitoring
- [ ] 7 days in production with zero conversion failures
- [ ] 7 days with zero redirect loop incidents

**Business:**
- [ ] Investor demo rehearsal successful (no conversion failures)
- [ ] Support team trained on new monitoring dashboards
- [ ] Engineering team can explain architecture in < 30 minutes
- [ ] Incident post-mortem completed and learnings documented

---

**Document Status:** Draft → Ready for Technical Review

**Next Steps:**
1. Technical review by senior backend engineer
2. Security review by platform team
3. Timeline review by engineering manager
4. Stakeholder approval (CTO, product lead)
5. Create detailed implementation tickets in Linear
6. Update CAM-129 status to "Ready for Development"
7. Begin Phase 1 (Observability) immediately

---

**Last Updated:** 2025-10-31
**Next Review:** After technical review feedback
