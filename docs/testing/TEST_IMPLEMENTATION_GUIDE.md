# Test Implementation Guide - Step by Step

**Version**: 1.0
**Created**: 2025-10-31
**Audience**: Developers implementing the test strategy
**Estimated Total Time**: 40-50 hours (2-3 weeks for 1 engineer)

---

## Overview

This guide provides a step-by-step implementation plan for the comprehensive test strategy. Follow the phases in order to incrementally add test coverage while maintaining development velocity.

**Philosophy**: Start with the highest-value test (conversion pipeline E2E), then expand coverage systematically.

---

## Phase 1: Critical Path Protection (Week 1)

**Goal**: Single E2E test that would have caught the Oct 30 incident
**Time**: 16-20 hours
**Value**: CRITICAL - Prevents regression of most important user journey

### Day 1: Setup (4-5 hours)

#### 1.1 Install Playwright

```bash
cd /e/Projects/Saas_CampOS

# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install chromium

# Initialize Playwright config
npx playwright init
```

#### 1.2 Create Playwright Configuration

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sequential for conversion tests
  reporter: [
    ['html'],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
```

#### 1.3 Create Test Utilities Directory Structure

```bash
mkdir -p tests/e2e
mkdir -p tests/utils
mkdir -p tests/fixtures
mkdir -p tests/integration/middleware
mkdir -p tests/integration/webhooks
mkdir -p tests/integration/api
mkdir -p tests/security
mkdir -p tests/performance
```

#### 1.4 Create Time-Invariant Date Helpers

Create `tests/utils/date-helpers.ts`:

```typescript
export function futureDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

export function now(): string {
  return new Date().toISOString()
}

export function getNextDayOfWeek(dayOfWeek: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDay = days.indexOf(dayOfWeek.toLowerCase())

  if (targetDay === -1) {
    throw new Error(`Invalid day: ${dayOfWeek}`)
  }

  const today = new Date()
  const currentDay = today.getDay()
  const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7

  today.setDate(today.getDate() + daysUntilTarget)
  return today.toISOString().split('T')[0]
}
```

#### 1.5 Create ID Helpers

Create `tests/utils/id-helpers.ts`:

```typescript
export function testId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function testUUID(): string {
  return crypto.randomUUID()
}

export function testEmail(prefix: string = 'test'): string {
  return `${prefix}-${testId()}@example.com`
}

export function testSlug(base: string): string {
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${testId()}`
}
```

### Day 2-3: Implement Conversion Pipeline E2E Test (8-10 hours)

#### 2.1 Create Database Cleanup Helpers

Create `tests/utils/db-helpers.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function cleanupTestCompany(companyName: string) {
  await supabase
    .from('companies')
    .delete()
    .eq('name', companyName)
}

export async function cleanupTestData() {
  await supabase.from('bookings').delete().ilike('guest_email', '%@example.com')
  await supabase.from('properties').delete().ilike('slug', 'test-%')
  await supabase.from('companies').delete().ilike('name', 'Test Company%')
}
```

#### 2.2 Implement Conversion Pipeline E2E Test

Create `tests/e2e/conversion-pipeline.spec.ts`:

Copy the full implementation from `E2E_TEST_SPECIFICATIONS.md` section "Test 1: Complete Conversion Pipeline"

#### 2.3 Test the Test

```bash
# Run locally
npm run test:e2e

# Run in headed mode to watch
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

#### 2.4 Verify Test Catches Regression

Manually revert the Oct 30 fix in `lib/supabase/middleware.ts`:

```typescript
// Comment out the wizard access logic temporarily
// const isWizardOrOnboarding =
//   request.nextUrl.searchParams.get("wizard") === "true" ||
//   pathname.startsWith("/onboarding")

// if (!isWizardOrOnboarding) {
  // Check for incomplete properties...
// }
```

Run test - it SHOULD FAIL. Restore the fix - test SHOULD PASS.

### Day 4: Add Test to CI/CD (4-5 hours)

#### 4.1 Create GitHub Actions Workflow

Create `.github/workflows/test-conversion-pipeline.yml`:

```yaml
name: Test Conversion Pipeline

on:
  pull_request:
    branches: [main]
    paths:
      - 'lib/supabase/middleware.ts'
      - 'app/api/stripe/webhook/**'
      - 'app/api/onboarding/**'
  push:
    branches: [main]

jobs:
  e2e-critical:
    name: Critical E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Build app
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

#### 4.2 Configure Branch Protection

In GitHub Settings → Branches:
1. Add branch protection rule for `main`
2. Require status check: "Critical E2E Tests"
3. Require PR review before merging

#### 4.3 Test the Pipeline

1. Create a test PR with a minor change
2. Verify workflow runs automatically
3. Verify test passes and PR can merge

---

## Phase 2: Integration & Contract Tests (Week 2)

**Goal**: Cover middleware, webhooks, and API contracts
**Time**: 16-20 hours
**Value**: HIGH - Catches logic bugs before E2E

### Day 5: Setup Integration Test Framework (3-4 hours)

#### 5.1 Create Vitest Integration Config

Create `vitest.config.integration.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'integration',
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

#### 5.2 Create Integration Test Setup

Create `tests/integration/setup.ts`:

```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { cleanupTestData } from '../utils/db-helpers'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

beforeAll(async () => {
  console.log('[Test Setup] Starting integration tests')
  const { error } = await supabase.from('companies').select('count').limit(1)
  if (error) throw new Error(`Database connection failed: ${error.message}`)
})

beforeEach(async () => {
  await cleanupTestData()
})

afterEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  console.log('[Test Setup] Integration tests complete')
})
```

### Day 6: Implement Middleware Tests (4-5 hours)

#### 6.1 Create Test Factories

Create `tests/utils/test-factories.ts`:

Copy implementation from `TEST_UTILITIES_DESIGN.md`

#### 6.2 Create Middleware Helpers

Create `tests/utils/middleware-helpers.ts`:

Copy implementation from `TEST_UTILITIES_DESIGN.md`

#### 6.3 Implement Middleware Tests

Create `tests/integration/middleware/wizard-access.test.ts`:

Copy implementation from `INTEGRATION_TEST_SPECIFICATIONS.md`

#### 6.4 Run Tests

```bash
npm run test:integration
```

### Day 7: Implement Webhook Tests (4-5 hours)

#### 7.1 Create Stripe Helpers

Create `tests/utils/stripe-helpers.ts`:

Copy implementation from `TEST_UTILITIES_DESIGN.md`

#### 7.2 Implement Webhook Tests

Create `tests/integration/webhooks/checkout-completed.test.ts`:
Create `tests/integration/webhooks/race-conditions.test.ts`:

Copy implementations from `INTEGRATION_TEST_SPECIFICATIONS.md`

#### 7.3 Run Tests

```bash
npm run test:integration
```

### Day 8: Implement API Contract Tests (3-4 hours)

#### 8.1 Install Zod (if not already installed)

```bash
npm install zod
```

#### 8.2 Create API Response Schemas

Create `lib/schemas/api-schemas.ts`:

```typescript
import { z } from 'zod'

export const PropertySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  company_id: z.string(),
  owner_id: z.string(),
  site_count: z.number().nullable(),
  onboarding_completed: z.boolean(),
  wizard_step_completed: z.string().nullable(),
  wizard_progress: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const PropertyListResponseSchema = z.object({
  properties: z.array(PropertySchema)
})
```

#### 8.3 Implement Properties API Contract Test

Create `tests/integration/api/properties-api.test.ts`:

Copy implementation from `INTEGRATION_TEST_SPECIFICATIONS.md`

#### 8.4 Add Runtime Validation to API

Update `app/api/onboarding/properties/route.ts`:

```typescript
import { PropertyListResponseSchema } from '@/lib/schemas/api-schemas'

export async function GET(request: NextRequest) {
  // ... existing code ...

  const response = { properties: data }

  // Validate before returning
  PropertyListResponseSchema.parse(response)

  return NextResponse.json(response)
}
```

### Day 9: Add Integration Tests to CI/CD (2-3 hours)

Update `.github/workflows/test-conversion-pipeline.yml`:

Add integration test job (see `CI_CD_TEST_PIPELINE.md` for full spec)

---

## Phase 3: Security & Performance Tests (Week 3)

**Goal**: Tenant isolation and performance validation
**Time**: 10-12 hours
**Value**: MEDIUM - Critical for multi-tenant SaaS

### Day 10: Implement Security Tests (4-5 hours)

#### 10.1 Create Tenant Isolation Tests

Create `tests/security/tenant-isolation.test.ts`:

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { GET as propertiesHandler } from '@/app/api/onboarding/properties/route'
import { createTestUser, createTestCompany, createTestProperty } from '../utils/test-factories'
import { mockApiRequest } from '../utils/api-helpers'
import { supabase } from '../integration/setup'

describe('Security - Tenant Isolation', () => {
  test('user cannot access another tenant\'s properties', async () => {
    // Create two separate tenants
    const tenant1User = await createTestUser()
    const tenant1Company = await createTestCompany({ owner_id: tenant1User.id })
    const tenant1Property = await createTestProperty({ company_id: tenant1Company.id })

    const tenant2User = await createTestUser()
    const tenant2Company = await createTestCompany({ owner_id: tenant2User.id })
    const tenant2Property = await createTestProperty({ company_id: tenant2Company.id })

    // Tenant 1 user requests properties
    const request = mockApiRequest({
      method: 'GET',
      user: tenant1User
    })

    const response = await propertiesHandler(request)
    const data = await response.json()

    // Should only see their own property
    expect(data.properties).toHaveLength(1)
    expect(data.properties[0].id).toBe(tenant1Property.id)
    expect(data.properties[0].id).not.toBe(tenant2Property.id)
  })
})
```

#### 10.2 Run Security Tests

```bash
npm run test:security
```

### Day 11: Implement Performance Tests (3-4 hours)

#### 11.1 Create Performance Test

Create `tests/performance/middleware-latency.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { updateSession } from '@/lib/supabase/middleware'
import { mockNextRequest } from '../utils/middleware-helpers'
import { createTestUser, setupUserWithSubscription } from '../utils/test-factories'

describe('Performance - Middleware Latency', () => {
  test('middleware completes within 100ms p99', async () => {
    const { user } = await setupUserWithSubscription()

    const iterations = 100
    const latencies: number[] = []

    for (let i = 0; i < iterations; i++) {
      const request = mockNextRequest({
        pathname: '/dashboard',
        searchParams: {},
        user
      })

      const start = performance.now()
      await updateSession(request)
      const duration = performance.now() - start

      latencies.push(duration)
    }

    // Calculate p99 (99th percentile)
    latencies.sort((a, b) => a - b)
    const p99Index = Math.floor(iterations * 0.99)
    const p99 = latencies[p99Index]

    console.log(`Middleware p99 latency: ${p99.toFixed(2)}ms`)

    expect(p99).toBeLessThan(100)
  })
})
```

### Day 12: Add Security & Performance to CI/CD (3-4 hours)

Update GitHub Actions workflow to include security and performance tests

---

## Phase 4: Documentation & Training (Ongoing)

### Create Testing Guidelines

Create `.claude/testing-guidelines.md`:

Document all testing best practices, examples, and common pitfalls.

### Team Training

1. Code review checklist for test quality
2. Pair programming sessions on test writing
3. "Test of the Week" code reviews

---

## Implementation Checklist

### Week 1: Critical Path
- [ ] Install Playwright
- [ ] Create test utilities (date-helpers, id-helpers)
- [ ] Implement conversion pipeline E2E test
- [ ] Verify test catches Oct 30 regression
- [ ] Add E2E test to CI/CD
- [ ] Configure branch protection

### Week 2: Integration Coverage
- [ ] Setup Vitest integration tests
- [ ] Create test factories
- [ ] Implement middleware tests
- [ ] Implement webhook tests
- [ ] Implement API contract tests
- [ ] Add runtime validation to APIs
- [ ] Add integration tests to CI/CD

### Week 3: Security & Performance
- [ ] Implement tenant isolation tests
- [ ] Implement performance benchmarks
- [ ] Add to CI/CD
- [ ] Document testing guidelines
- [ ] Train team on testing practices

---

## Verification & Validation

### How to Know You're Done

1. **E2E Test Passes Consistently**
   - 10 consecutive local runs without flakes
   - Passes in CI/CD without retries
   - Test catches regression when middleware fix is reverted

2. **Integration Tests Provide Fast Feedback**
   - Full integration suite runs in < 30 seconds
   - Clear error messages on failure
   - Tests are independent (order doesn't matter)

3. **Security Tests Validate Isolation**
   - Tenant A cannot access Tenant B's data
   - All API endpoints enforce tenant filtering
   - No data leakage in test scenarios

4. **CI/CD Blocks Bad Deployments**
   - PR cannot merge if tests fail
   - Team understands which tests block deployment
   - Rollback strategy tested and documented

---

## Troubleshooting

### Common Issues

#### E2E Tests Timing Out
```bash
# Increase timeouts in playwright.config.ts
use: {
  actionTimeout: 30000, // Increase from 10000
}
```

#### Flaky Tests
1. Check for hardcoded dates → use futureDays()
2. Check for hardcoded IDs → use testId()
3. Add proper waits → waitForLoadState('networkidle')
4. Check for race conditions → await all async operations

#### Database Cleanup Fails
```typescript
// Add CASCADE to foreign key relationships in schema
// Or delete in correct order (children first, parents last)
await supabase.from('bookings').delete()
await supabase.from('properties').delete()
await supabase.from('companies').delete()
```

---

## Maintenance

### Weekly Tasks
- Review flaky test dashboard
- Update test utilities for new patterns
- Archive obsolete tests

### Monthly Tasks
- Review test coverage reports
- Update test strategy based on incidents
- Refactor common test patterns

---

## Success Metrics

Track these metrics monthly:

| Metric | Target | Current |
|--------|--------|---------|
| E2E Test Pass Rate | > 99% | TBD |
| Integration Test Pass Rate | > 99% | TBD |
| Test Execution Time | < 15 min | TBD |
| Flaky Test Rate | < 1% | TBD |
| Production Incidents | 0 conversion pipeline bugs | TBD |

---

**Document Owner**: Test Architect
**Last Updated**: 2025-10-31
**Next Review**: After Phase 1 completion

**Related Documentation**:
- [Test Strategy](./TEST_STRATEGY.md)
- [E2E Test Specifications](./E2E_TEST_SPECIFICATIONS.md)
- [Integration Test Specifications](./INTEGRATION_TEST_SPECIFICATIONS.md)
- [Test Utilities Design](./TEST_UTILITIES_DESIGN.md)
- [CI/CD Test Pipeline](./CI_CD_TEST_PIPELINE.md)
