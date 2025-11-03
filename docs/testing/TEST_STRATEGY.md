# Test Strategy - Conversion Pipeline Protection

**Version**: 1.0
**Created**: 2025-10-31
**Incident Reference**: [ONBOARDING_CRISIS_HANDOFF.md](../reference/ONBOARDING_CRISIS_HANDOFF.md)
**Status**: REQUIRED - These tests MUST pass before deploying middleware, webhook, or onboarding changes

---

## Executive Summary

This document defines the comprehensive testing strategy to prevent recurrence of the October 30, 2025 conversion pipeline incident. The incident resulted in complete onboarding failure, zero conversion rate, and customer loss due to **ZERO automated test coverage** for the critical user journey: payment → onboarding → dashboard.

**Primary Goal**: Ensure no regression can break the conversion pipeline without detection.

**Secondary Goal**: Establish systematic testing practices for all critical paths.

---

## Testing Philosophy

### The Test Pyramid for CampOS

```
              /\
             /  \
            /E2E \         <- 10% (Critical user journeys only)
           /------\
          /  INT   \       <- 30% (API contracts, middleware logic, webhooks)
         /----------\
        /    UNIT    \     <- 60% (Business logic, utilities, calculations)
       /--------------\
```

### Guiding Principles

1. **Pragmatic Coverage**: Test what breaks, not everything
2. **Critical Path First**: 100% coverage of conversion pipeline before anything else
3. **Fast Feedback**: Unit tests < 5s, Integration < 30s, E2E < 5 min
4. **No Flaky Tests**: Time-invariant test data, proper waits, deterministic assertions
5. **Maintainable**: Clear test names, no copy-paste, reusable utilities

### Test Classification

| Type | Purpose | When to Use | Tools | Speed |
|------|---------|-------------|-------|-------|
| **Unit** | Test pure functions, business logic | Isolated code, calculations, transformations | Vitest | < 100ms |
| **Integration** | Test API contracts, DB queries, middleware | Multi-component interactions, API endpoints | Vitest + Supabase Test Client | < 2s |
| **Security** | Test tenant isolation, auth guards | Multi-tenant features, sensitive data | Vitest + Supabase Test Client | < 2s |
| **E2E** | Test complete user workflows | Critical user journeys, full stack verification | Playwright | < 2 min |
| **Contract** | Test API response schemas | API endpoints, external integrations | Vitest + Zod | < 500ms |
| **Performance** | Test latency, throughput | Critical paths, bottlenecks | Vitest + custom timers | < 5s |

---

## Coverage Goals

### Phase 1: Critical Path Protection (Week 1)

**Goal**: Single E2E test that would have caught the Oct 30 incident

| Area | Coverage Target | Rationale |
|------|----------------|-----------|
| Conversion Pipeline E2E | 100% | This IS the business |
| Middleware wizard logic | 100% | Regression happened here |
| Properties API contract | 100% | Silent failure happened here |
| Webhook race conditions | 100% | Data corruption risk |

### Phase 2: Comprehensive Coverage (Week 2-3)

| Area | Coverage Target | Rationale |
|------|----------------|-----------|
| Business logic (pricing, availability) | 90%+ | Revenue impact |
| API endpoints | 80%+ | Customer-facing |
| Tenant isolation | 100% | Security critical |
| Auth flows | 80%+ | Access control |
| UI components | 60%+ | User experience |

### Ongoing Maintenance

- New features MUST include tests before merge
- Critical path tests MUST pass in CI/CD before deploy
- Test coverage cannot decrease (enforced by CI)
- Flaky tests are bugs (fix immediately)

---

## Test Organization

### Directory Structure

```
/e/Projects/Saas_CampOS/
├── tests/
│   ├── e2e/                           # Playwright E2E tests
│   │   ├── conversion-pipeline.spec.ts    ← HIGHEST PRIORITY
│   │   ├── wizard-navigation.spec.ts
│   │   ├── dashboard-access.spec.ts
│   │   └── fixtures/
│   │       ├── stripe-events.ts
│   │       └── test-users.ts
│   │
│   ├── integration/                   # Vitest integration tests
│   │   ├── middleware/
│   │   │   ├── wizard-access.test.ts      ← CRITICAL
│   │   │   ├── auth-guards.test.ts
│   │   │   └── redirect-logic.test.ts
│   │   ├── webhooks/
│   │   │   ├── checkout-completed.test.ts  ← CRITICAL
│   │   │   ├── subscription-events.test.ts
│   │   │   ├── race-conditions.test.ts     ← CRITICAL
│   │   │   └── idempotency.test.ts
│   │   └── api/
│   │       ├── properties-api.test.ts      ← CRITICAL
│   │       ├── wizard-progress.test.ts
│   │       └── company-api.test.ts
│   │
│   ├── security/                      # Multi-tenant isolation tests
│   │   ├── tenant-isolation.test.ts       ← REQUIRED for multi-tenant features
│   │   ├── wizard-access-control.test.ts
│   │   └── data-leakage.test.ts
│   │
│   ├── contract/                      # API schema validation
│   │   ├── api-response-schemas.test.ts   ← Prevents silent failures
│   │   └── webhook-payload-schemas.test.ts
│   │
│   ├── performance/                   # Performance benchmarks
│   │   ├── middleware-latency.test.ts
│   │   └── api-response-time.test.ts
│   │
│   └── utils/                         # Test utilities
│       ├── date-helpers.ts                ← Dynamic date generation
│       ├── id-helpers.ts                  ← Unique ID generation
│       ├── db-helpers.ts                  ← Database setup/teardown
│       ├── api-helpers.ts                 ← API mocking/validation
│       ├── middleware-helpers.ts          ← Request/response mocking
│       └── stripe-helpers.ts              ← Stripe test mode utilities
│
├── lib/                               # Unit tests colocated with source
│   ├── booking/
│   │   ├── availability.ts
│   │   ├── availability.test.ts           ← Vitest unit tests
│   │   ├── pricing.ts
│   │   └── pricing.test.ts
│   └── ...
│
├── playwright.config.ts               # Playwright configuration
├── vitest.config.ts                   # Vitest configuration
└── .github/
    └── workflows/
        └── test-conversion-pipeline.yml   # CI/CD test pipeline
```

### File Naming Conventions

- **Unit tests**: `*.test.ts` (colocated with source)
- **Integration tests**: `*.test.ts` (in `tests/integration/`)
- **E2E tests**: `*.spec.ts` (in `tests/e2e/`)
- **Test utilities**: `*-helpers.ts` or `*-factory.ts` (in `tests/utils/`)
- **Fixtures**: `*-fixtures.ts` or `*-data.ts` (in `tests/fixtures/`)

---

## Critical Test Scenarios

### Priority: CRITICAL (Must Have)

These tests MUST pass before any deployment:

1. **Conversion Pipeline E2E** (`tests/e2e/conversion-pipeline.spec.ts`)
   - User completes payment → webhook → wizard → dashboard
   - NO redirect loops with wizard=true parameter
   - Properties API returns complete field set
   - Wizard loads within 5 seconds
   - Dashboard accessible after completion

2. **Middleware Wizard Access** (`tests/integration/middleware/wizard-access.test.ts`)
   - Allows `/dashboard?wizard=true` with incomplete onboarding
   - Redirects `/dashboard` without wizard param to `/onboarding`
   - No infinite redirect loops (circuit breaker)

3. **Webhook Race Conditions** (`tests/integration/webhooks/race-conditions.test.ts`)
   - Simultaneous events don't cause "Company not found" errors
   - Retry logic succeeds within 3 attempts
   - Idempotent processing (no duplicate companies)

4. **Properties API Contract** (`tests/contract/api-response-schemas.test.ts`)
   - Returns ALL required fields (regression test for incident)
   - Schema validation with Zod catches missing fields
   - PropertyContext can initialize with response data

### Priority: HIGH (Should Have)

5. **Webhook Idempotency** (`tests/integration/webhooks/idempotency.test.ts`)
6. **Tenant Isolation** (`tests/security/tenant-isolation.test.ts`)
7. **Auth Guards** (`tests/integration/middleware/auth-guards.test.ts`)
8. **Pricing Calculations** (unit tests colocated)
9. **Availability Logic** (unit tests colocated)

### Priority: MEDIUM (Nice to Have)

10. **Performance Benchmarks** (`tests/performance/middleware-latency.test.ts`)
11. **Visual Regression** (screenshots of wizard steps)
12. **Load Testing** (webhook processing under load)

---

## Testing Stack

### Tools & Technologies

| Tool | Purpose | Version | Documentation |
|------|---------|---------|---------------|
| **Vitest** | Unit & Integration testing | Latest | [vitest.dev](https://vitest.dev) |
| **Playwright** | E2E testing | Latest | [playwright.dev](https://playwright.dev) |
| **Testing Library** | Component testing | Latest | [testing-library.com](https://testing-library.com) |
| **Zod** | Schema validation | Latest | [zod.dev](https://zod.dev) |
| **Stripe Test Mode** | Payment testing | N/A | [stripe.com/docs/testing](https://stripe.com/docs/testing) |
| **Supabase Local** | Database testing | Latest | [supabase.com/docs/guides/local-development](https://supabase.com/docs/guides/local-development) |

### Test Environment Setup

#### Required Environment Variables

```bash
# Testing environment (.env.test)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<test-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<test-service-role-key>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=test
```

#### Test Database

- Use Supabase local development for integration tests
- Database reset before each test run
- Seed data for common scenarios
- Transaction rollback for fast cleanup

---

## CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Pull requests touching critical files
- Pushes to main branch
- Manual workflow dispatch

### Test Execution Stages

```yaml
Stage 1: Unit Tests (2 minutes)
  ├── Run all unit tests in parallel
  ├── Generate coverage report
  └── Fail fast if < 60% coverage

Stage 2: Integration Tests (5 minutes)
  ├── Start local Supabase
  ├── Run middleware tests
  ├── Run webhook tests
  ├── Run API contract tests
  └── Tear down test environment

Stage 3: Security Tests (3 minutes)
  ├── Tenant isolation tests
  ├── Auth guard tests
  └── Data leakage tests

Stage 4: E2E Tests (10 minutes)
  ├── Start production build
  ├── Run conversion pipeline test (CRITICAL)
  ├── Run wizard navigation test
  └── Capture screenshots on failure

Stage 5: Performance Tests (2 minutes)
  ├── Middleware latency benchmarks
  └── API response time checks
```

### Deployment Gates

| Gate | Requirement | Blocks Deployment? |
|------|-------------|-------------------|
| Unit tests pass | 100% pass rate | YES |
| Critical E2E tests pass | 100% pass rate | YES |
| Integration tests pass | 100% pass rate | YES |
| Security tests pass | 100% pass rate | YES |
| Coverage maintained | No decrease | YES |
| Performance budgets | < 100ms p99 middleware | WARNING |

---

## Testing Best Practices (CampOS-Specific)

### Time-Invariant Test Data (CRITICAL)

**NEVER** hardcode dates, times, or IDs that will break over time.

```typescript
// ❌ BAD: Will fail when date passes
test("booking in June 2025", () => {
  const booking = { date: "2025-06-01" }
  expect(isValid(booking)).toBe(true)
})

// ✅ GOOD: Always works
test("booking 30 days in future", () => {
  const booking = { date: futureDays(30) }
  expect(isValid(booking)).toBe(true)
})
```

**Use test utilities**:
- `futureDays(n)` - Date n days from now
- `getNextDayOfWeek('monday')` - Next occurrence of day
- `testId()` - Unique ID for this test run
- `testUUID()` - RFC-compliant test UUID

See: [testing-guidelines.md](../../.claude/testing-guidelines.md) (to be created)

### Multi-Tenant Testing (REQUIRED)

Every multi-tenant feature MUST have tenant isolation tests:

```typescript
test("user cannot access another tenant's properties", async () => {
  const tenant1 = await createTestTenant()
  const tenant2 = await createTestTenant()

  const property1 = await createProperty(tenant1.id)
  const property2 = await createProperty(tenant2.id)

  // User from tenant1 should only see their properties
  const response = await apiAs(tenant1.user).get("/api/properties")

  expect(response.data.properties).toHaveLength(1)
  expect(response.data.properties[0].id).toBe(property1.id)
  expect(response.data.properties[0].id).not.toBe(property2.id)
})
```

### Strong Assertions

Prefer specific assertions over weak ones:

```typescript
// ❌ WEAK: Too permissive
expect(result.length).toBeGreaterThan(0)

// ✅ STRONG: Exact expectation
expect(result).toEqual([expectedItem1, expectedItem2])

// ❌ WEAK: Doesn't validate structure
expect(response.status).toBe(200)

// ✅ STRONG: Validates complete response
expect(response).toMatchObject({
  status: 200,
  data: {
    properties: expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(String),
        slug: expect.any(String),
        wizard_step_completed: expect.anything()
      })
    ])
  }
})
```

### Test Independence

Each test must be independently runnable:

```typescript
// ❌ BAD: Tests depend on execution order
let user: User
test("creates user", () => { user = createUser() })
test("user can login", () => { expect(login(user)).toBe(true) })

// ✅ GOOD: Each test is independent
test("creates user", () => {
  const user = createUser()
  expect(user.id).toBeDefined()
})

test("user can login", () => {
  const user = createUser()
  expect(login(user)).toBe(true)
})
```

### Parameterized Tests

Test multiple scenarios efficiently:

```typescript
test.each([
  { wizard: "true", pathname: "/dashboard", shouldAllow: true },
  { wizard: "false", pathname: "/dashboard", shouldAllow: false },
  { wizard: "true", pathname: "/dashboard/sites", shouldAllow: true },
  { wizard: undefined, pathname: "/onboarding", shouldAllow: true },
])("middleware: wizard=$wizard pathname=$pathname → allow=$shouldAllow",
  async ({ wizard, pathname, shouldAllow }) => {
    const response = await middleware({
      pathname,
      searchParams: wizard ? { wizard } : {}
    })

    if (shouldAllow) {
      expect(response.status).toBe(200)
    } else {
      expect(response.status).toBe(307)
    }
})
```

---

## Test Data Management

### Test Factories

Create reusable factories for consistent test data:

```typescript
// tests/utils/factories/user-factory.ts
export async function createTestUser(overrides?: Partial<User>) {
  return await supabase.from("users").insert({
    email: `test-${testId()}@example.com`,
    email_confirmed_at: new Date().toISOString(),
    ...overrides
  }).select().single()
}

// tests/utils/factories/company-factory.ts
export async function createTestCompany(userId: string, overrides?: Partial<Company>) {
  return await supabase.from("companies").insert({
    owner_id: userId,
    name: `Test Company ${testId()}`,
    subscription_status: "active",
    stripe_customer_id: `cus_test_${testId()}`,
    ...overrides
  }).select().single()
}
```

### Database Cleanup

Use transactions for fast, reliable cleanup:

```typescript
import { describe, test, beforeEach, afterEach } from 'vitest'

describe("Properties API", () => {
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    // Setup test data
    const { user, company, property, cleanup: fn } = await setupTestData()
    cleanup = fn
  })

  afterEach(async () => {
    // Rollback all changes
    await cleanup()
  })

  test("returns all properties", async () => {
    // Test runs with clean state
  })
})
```

---

## Performance Budgets

### Test Execution Time Budgets

| Test Type | Budget | Current | Action if Exceeded |
|-----------|--------|---------|-------------------|
| Unit tests (all) | < 5s | TBD | Parallelize or optimize |
| Integration tests (all) | < 30s | TBD | Review DB queries |
| E2E conversion pipeline | < 5 min | TBD | Optimize waits |
| Full test suite | < 15 min | TBD | Investigate bottlenecks |

### Application Performance Budgets

Validated by performance tests:

| Operation | Budget | Test |
|-----------|--------|------|
| Middleware execution | < 100ms p99 | `middleware-latency.test.ts` |
| Properties API response | < 500ms p99 | `api-response-time.test.ts` |
| Webhook processing | < 2s p99 | `webhook-performance.test.ts` |

---

## Success Metrics

### Test Health

- **Pass Rate**: > 99% (flaky tests are bugs)
- **Execution Time**: < 15 minutes total
- **Coverage**: 60% unit, 80% integration on critical paths, 100% E2E on conversion pipeline
- **Flake Rate**: < 1% (zero tolerance for critical tests)

### Business Impact

- **Incident Prevention**: Zero conversion pipeline regressions
- **Development Velocity**: Faster deployments with confidence
- **Bug Detection**: Catch issues before production
- **MTTR**: < 30 minutes (with good test diagnostics)

### Monitoring

Track these metrics in CI/CD:
- Test pass rate over time
- Test execution time trends
- Coverage delta per PR
- Flaky test frequency

---

## FAQ

### Q: Why E2E tests when integration tests are faster?

**A**: E2E tests catch integration issues that unit/integration tests miss. The Oct 30 incident would have been caught by a single E2E test but passed all hypothetical unit tests. E2E tests verify the ACTUAL user experience.

### Q: How do we handle Stripe in tests?

**A**: Use Stripe test mode with test credit cards (4242 4242 4242 4242). Mock webhook events for unit/integration tests. Use real Stripe test mode for E2E tests.

### Q: Should we test third-party code (Next.js, Supabase)?

**A**: No. Test OUR integration with third parties, not the third parties themselves. Test that we call APIs correctly, not that the APIs work.

### Q: How do we prevent flaky tests?

**A**:
1. Use deterministic test data (no random IDs, use testId())
2. Proper async waits (await, not setTimeout)
3. Time-invariant dates (futureDays(), not hardcoded)
4. Database isolation (transactions, cleanup)
5. Idempotent operations (can run multiple times safely)

### Q: What if tests are too slow?

**A**:
1. Run unit tests in parallel (Vitest default)
2. Use transactions for fast DB cleanup
3. Mock external services in unit/integration tests
4. Reserve E2E tests for critical paths only
5. Profile slow tests and optimize

### Q: How do we test in production?

**A**:
- Synthetic monitoring (run subset of E2E tests hourly)
- Feature flags for gradual rollout
- Error tracking (Sentry)
- Real-time dashboards (conversion funnel)
- Rollback strategy ready

---

## Next Steps

1. **Read**: [E2E Test Specifications](./E2E_TEST_SPECIFICATIONS.md)
2. **Read**: [Integration Test Specifications](./INTEGRATION_TEST_SPECIFICATIONS.md)
3. **Read**: [Test Utilities Design](./TEST_UTILITIES_DESIGN.md)
4. **Read**: [Test Implementation Guide](./TEST_IMPLEMENTATION_GUIDE.md)
5. **Implement**: Start with conversion pipeline E2E test (highest ROI)

---

**Document Owner**: Test Architect
**Last Updated**: 2025-10-31
**Next Review**: After Phase 1 implementation
