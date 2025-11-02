# Testing Requirements - Preventing Future Incidents

**Document Version**: 1.0
**Created**: 2025-10-30
**Status**: REQUIRED
**Incident Reference**: [ONBOARDING_CRISIS_HANDOFF.md](../reference/ONBOARDING_CRISIS_HANDOFF.md)

---

## Executive Summary

This document defines MANDATORY testing requirements to prevent recurrence of the October 30 conversion pipeline incident. These tests MUST pass before any deployment touching middleware, webhooks, or onboarding APIs.

**Critical Finding**: The incident occurred because NO automated tests covered the complete conversion pipeline. Changes that broke critical user journeys were deployed without detection.

---

## CRITICAL PATH: Conversion Pipeline E2E Tests

### Required Test Coverage

```typescript
// tests/e2e/conversion-pipeline.spec.ts

/**
 * CRITICAL PATH TEST
 *
 * This test MUST pass before deploying changes to:
 * - Middleware (lib/supabase/middleware.ts)
 * - Stripe webhook (app/api/stripe/webhook/route.ts)
 * - Properties API (app/api/onboarding/properties/route.ts)
 * - Onboarding wizard components
 *
 * Incident Reference: 2025-10-30 - Refactor broke this flow
 */

describe("Conversion Pipeline - NEW USER SIGNUP", () => {
  test("CRITICAL: User can complete onboarding after payment", async ({ page }) => {
    // This is THE most important test in the entire codebase
    // If this fails, new customers cannot use the product

    // Step 1: Navigate to plan selection
    await page.goto("/choose-plan")
    await expect(page).toHaveURL(/\/choose-plan/)

    // Step 2: Select plan and configure properties
    await page.click('[data-testid="plan-starter"]')
    await page.fill('[data-testid="company-name"]', "Pine Valley Campground")
    await page.fill('[data-testid="property-name-0"]', "Pine Valley")
    await page.fill('[data-testid="site-count-0"]', "50")
    await page.click('[data-testid="checkout-button"]')

    // Step 3: Complete Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
    await fillStripeTestCheckout(page, {
      card: "4242424242424242",
      email: "test@example.com"
    })

    // Step 4: Should redirect to wizard
    await expect(page).toHaveURL(/\/dashboard\/sites\?wizard=true/, {
      timeout: 10000  // Webhook processing can take time
    })

    // Step 5: CRITICAL - Verify NO redirect loops
    const urlBeforeWait = page.url()
    await page.waitForTimeout(3000)
    const urlAfterWait = page.url()

    expect(urlAfterWait).toBe(urlBeforeWait)  // URL should NOT change
    expect(urlAfterWait).toContain("wizard=true")

    // Step 6: Wizard should load (not infinite spinner)
    await expect(page.locator('[data-testid="onboarding-wizard"]')).toBeVisible({
      timeout: 5000
    })

    // Verify property data loaded
    await expect(page.locator('text=Pine Valley')).toBeVisible()

    // Step 7: Complete wizard steps
    await completeWizardSteps(page)

    // Step 8: Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard$/, {
      timeout: 5000
    })

    // Step 9: Success toast should appear
    await expect(page.locator('text=Setup Complete')).toBeVisible()

    // Step 10: User should have full access
    await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible()
  })

  test("CRITICAL: Wizard accessible with incomplete onboarding", async ({ page }) => {
    // Regression test for Oct 30 incident

    // Setup: User with paid subscription but incomplete onboarding
    const { user, company } = await setupUserWithSubscription()
    await createIncompleteProperty(company.id)

    await loginAs(page, user)

    // Navigate directly to wizard
    await page.goto("/dashboard/sites?wizard=true")

    // Should NOT redirect to /onboarding
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveURL(/wizard=true/)

    // Wizard should load
    await expect(page.locator('[data-testid="onboarding-wizard"]')).toBeVisible()
  })

  test("CRITICAL: No redirect loop detection", async ({ page }) => {
    // Regression test for Oct 30 incident

    const { user, company } = await setupUserWithSubscription()
    await createIncompleteProperty(company.id)

    await loginAs(page, user)

    // Track all redirects
    let redirectCount = 0
    page.on("response", (response) => {
      if (response.status() === 307 || response.status() === 302) {
        redirectCount++
      }
    })

    await page.goto("/dashboard/sites?wizard=true")

    // Should have <= 1 redirect (auth check)
    // More than 3 indicates infinite loop
    expect(redirectCount).toBeLessThan(3)
  })
})
```

---

## Integration Tests: Middleware

```typescript
// tests/integration/middleware-wizard-access.test.ts

describe("Middleware - Wizard Access Logic", () => {
  test("allows /dashboard when wizard=true and onboarding incomplete", async () => {
    const { user, company } = await setupUserWithSubscription()
    await createIncompleteProperty(company.id)

    const response = await request(app)
      .get("/dashboard/sites?wizard=true")
      .set("Authorization", `Bearer ${user.token}`)

    expect(response.status).toBe(200)
    expect(response.headers["x-redirect"]).toBeUndefined()
  })

  test("redirects /dashboard WITHOUT wizard to /onboarding", async () => {
    const { user, company } = await setupUserWithSubscription()
    await createIncompleteProperty(company.id)

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", `Bearer ${user.token}`)
      .redirects(0)  // Don't follow redirects

    expect(response.status).toBe(307)
    expect(response.headers.location).toBe("/onboarding")
  })

  test("allows /onboarding path with incomplete onboarding", async () => {
    const { user, company } = await setupUserWithSubscription()
    await createIncompleteProperty(company.id)

    const response = await request(app)
      .get("/onboarding")
      .set("Authorization", `Bearer ${user.token}`)

    expect(response.status).toBe(200)
  })
})
```

---

## Integration Tests: Webhooks

```typescript
// tests/integration/stripe-webhooks.test.ts

describe("Stripe Webhooks", () => {
  test("handles race condition between checkout and subscription events", async () => {
    const checkoutEvent = mockStripeEvent("checkout.session.completed", {
      metadata: { supabase_user_id: "user_123" }
    })

    const subscriptionEvent = mockStripeEvent("customer.subscription.created", {
      customer: checkoutEvent.data.object.customer
    })

    // Fire events simultaneously (race condition)
    await Promise.all([
      processWebhook(checkoutEvent),
      processWebhook(subscriptionEvent)
    ])

    // Both should succeed
    const company = await getCompanyByStripeId(checkoutEvent.data.object.customer)
    expect(company).toBeDefined()
    expect(company.subscription_status).toBe("active")
  })

  test("is idempotent - duplicate events don't create duplicate data", async () => {
    const event = mockStripeEvent("checkout.session.completed")

    // Process same event twice
    await processWebhook(event)
    await processWebhook(event)

    // Should have exactly one company
    const companies = await getCompaniesByUser(event.metadata.supabase_user_id)
    expect(companies).toHaveLength(1)
  })
})
```

---

## Integration Tests: Properties API

```typescript
// tests/integration/properties-api.test.ts

describe("Properties API", () => {
  test("returns ALL required fields", async () => {
    const { user, company } = await setupUserWithCompany()
    const property = await createProperty(company.id)

    const response = await request(app)
      .get("/api/onboarding/properties")
      .set("Authorization", `Bearer ${user.token}`)

    expect(response.status).toBe(200)

    const data = response.body

    // CRITICAL: Verify all fields present
    expect(data.properties[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      company_id: expect.any(String),
      owner_id: expect.any(String),
      site_count: expect.anything(),
      onboarding_completed: expect.any(Boolean),
      wizard_step_completed: expect.anything(),
      wizard_progress: expect.anything(),
      created_at: expect.any(String),
      updated_at: expect.any(String)
    })

    // Regression test: These fields were MISSING in incident
    expect(data.properties[0].slug).toBeDefined()
    expect(data.properties[0].wizard_step_completed).toBeDefined()
  })

  test("validates response against PropertyListResponseSchema", async () => {
    const { user, company } = await setupUserWithCompany()
    await createProperty(company.id)

    const response = await request(app)
      .get("/api/onboarding/properties")
      .set("Authorization", `Bearer ${user.token}`)

    const data = response.body

    // Schema validation
    expect(() => {
      PropertyListResponseSchema.parse(data)
    }).not.toThrow()
  })
})
```

---

## Security Tests: Tenant Isolation

```typescript
// tests/security/tenant-isolation.test.ts

describe("Tenant Isolation - Onboarding", () => {
  test("user cannot access another company's properties", async () => {
    const { user: user1, company: company1 } = await setupUserWithCompany()
    const { user: user2, company: company2 } = await setupUserWithCompany()

    const property1 = await createProperty(company1.id)
    const property2 = await createProperty(company2.id)

    // User 1 should only see their properties
    const response = await request(app)
      .get("/api/onboarding/properties")
      .set("Authorization", `Bearer ${user1.token}`)

    const data = response.body

    expect(data.properties).toHaveLength(1)
    expect(data.properties[0].id).toBe(property1.id)
    expect(data.properties[0].id).not.toBe(property2.id)
  })
})
```

---

## Performance Tests

```typescript
// tests/performance/middleware.test.ts

describe("Middleware Performance", () => {
  test("completes within acceptable latency", async () => {
    const { user } = await setupUserWithSubscription()

    const start = Date.now()

    await request(app)
      .get("/dashboard")
      .set("Authorization", `Bearer ${user.token}`)

    const duration = Date.now() - start

    // Middleware should complete in < 100ms (p99)
    expect(duration).toBeLessThan(100)
  })
})
```

---

## Pre-Deployment Test Suite

### MANDATORY Tests Before Deploy

```bash
# Run before ANY deployment

# 1. Conversion pipeline E2E (CRITICAL)
npm run test:e2e:conversion-pipeline

# 2. Middleware integration tests
npm run test:integration:middleware

# 3. Webhook integration tests
npm run test:integration:webhooks

# 4. API contract tests
npm run test:integration:api-contracts

# 5. Security tests
npm run test:security

# 6. Full test suite
npm run test:ci

# All must pass before deploy
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Conversion Pipeline Tests

on:
  pull_request:
    paths:
      - "lib/supabase/middleware.ts"
      - "app/api/stripe/webhook/**"
      - "app/api/onboarding/**"
      - "components/onboarding/**"

jobs:
  critical-path-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Run conversion pipeline E2E tests
        run: npm run test:e2e:conversion-pipeline

      - name: Run middleware integration tests
        run: npm run test:integration:middleware

      - name: Run webhook integration tests
        run: npm run test:integration:webhooks

      - name: Run API contract tests
        run: npm run test:integration:api-contracts

      - name: Comment PR if tests fail
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚨 CRITICAL PATH TESTS FAILED\n\nThese changes affect the conversion pipeline. All tests must pass before merge.\n\nSee [Incident Report](../docs/reference/ONBOARDING_CRISIS_HANDOFF.md) for context.'
            })
```

---

## Test Data Management

### Factories for Consistent Test Data

```typescript
// tests/factories/user.factory.ts

export async function setupUserWithSubscription() {
  const user = await createUser({
    email: `test-${Date.now()}@example.com`,
    email_confirmed_at: new Date().toISOString()
  })

  const company = await createCompany({
    owner_id: user.id,
    name: "Test Company",
    subscription_status: "active",
    stripe_customer_id: `cus_test_${Date.now()}`
  })

  return { user, company }
}

export async function createIncompleteProperty(company_id: string) {
  return await createProperty({
    company_id,
    name: "Test Property",
    slug: `test-${Date.now()}`,
    onboarding_completed: false,
    wizard_step_completed: null,
    wizard_progress: 0
  })
}
```

---

## Success Criteria

### Test Coverage Requirements

- [ ] 100% E2E coverage of conversion pipeline
- [ ] 100% integration coverage of middleware wizard logic
- [ ] 100% integration coverage of webhook handlers
- [ ] 100% contract coverage of critical APIs
- [ ] 100% security coverage of tenant isolation

### Deployment Gates

- [ ] All critical path tests must pass
- [ ] Test coverage must not decrease
- [ ] No failing tests allowed in main branch
- [ ] PR cannot merge if conversion tests fail

### Monitoring

- [ ] Test execution time tracked
- [ ] Flaky test detection
- [ ] Test failure rate alerts
- [ ] Coverage reports in PR comments

---

## Priority Order for Implementation

1. **CRITICAL** (This Week):
   - Conversion pipeline E2E test
   - Middleware wizard access integration tests
   - Properties API contract tests

2. **HIGH** (Next Week):
   - Webhook race condition tests
   - Webhook idempotency tests
   - Security tenant isolation tests

3. **MEDIUM** (This Sprint):
   - Performance tests
   - Full CI/CD integration
   - Test data factories

4. **NICE TO HAVE**:
   - Visual regression tests
   - Load tests
   - Chaos engineering tests

---

**For Test Architect**: Start with the conversion pipeline E2E test. This single test would have caught the October 30 incident. It's the highest ROI test in the codebase.

**Related Documents**:
- [Middleware Architecture](./MIDDLEWARE_ARCHITECTURE.md)
- [Webhook Resilience](./WEBHOOK_RESILIENCE_ARCHITECTURE.md)
- [API Contract Safety](./API_CONTRACT_SAFETY.md)
