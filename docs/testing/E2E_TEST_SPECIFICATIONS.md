# E2E Test Specifications - Conversion Pipeline

**Version**: 1.0
**Created**: 2025-10-31
**Priority**: CRITICAL - These tests MUST be implemented first
**Estimated Implementation Time**: 12-16 hours

---

## Overview

This document provides detailed, implementable specifications for end-to-end (E2E) tests covering the complete conversion pipeline. These tests verify the entire user journey from plan selection through payment to dashboard access.

**Primary Goal**: A single E2E test that would have caught the October 30, 2025 incident.

---

## Test Environment Setup

### Prerequisites

```bash
# Install Playwright
npm install -D @playwright/test

# Install Playwright browsers
npx playwright install

# Initialize Playwright config
npx playwright init
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run conversion tests sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // One worker for conversion tests
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

### Test Environment Variables

```bash
# .env.test
PLAYWRIGHT_BASE_URL=http://localhost:3000
STRIPE_TEST_CARD=4242424242424242
STRIPE_TEST_EMAIL=test@example.com
TEST_CLEANUP_ENABLED=true
```

---

## Test 1: Complete Conversion Pipeline (CRITICAL)

**File**: `tests/e2e/conversion-pipeline.spec.ts`
**Duration**: ~3-4 minutes
**Priority**: CRITICAL - This is THE most important test

### Test Scenario

A new user goes through the complete signup flow:
1. Visit plan selection page
2. Choose plan and configure properties
3. Complete Stripe checkout with test card
4. Stripe webhook creates company and properties
5. Redirected to onboarding wizard with `wizard=true`
6. Wizard loads successfully (NO redirect loops)
7. Complete all wizard steps
8. Redirected to dashboard
9. Dashboard accessible with full features

### Implementation

```typescript
import { test, expect, type Page } from '@playwright/test'
import { futureDays, testId } from '../utils/date-helpers'
import { cleanupTestCompany } from '../utils/db-helpers'

/**
 * CRITICAL PATH TEST
 *
 * This test MUST pass before deploying changes to:
 * - Middleware (lib/supabase/middleware.ts)
 * - Stripe webhook (app/api/stripe/webhook/route.ts)
 * - Properties API (app/api/onboarding/properties/route.ts)
 * - Onboarding wizard components
 *
 * Incident Reference: 2025-10-30 - Middleware refactor broke this flow
 */

test.describe('Conversion Pipeline - NEW USER SIGNUP', () => {
  const companyName = `Test Company ${testId()}`
  const propertyName = `Test Property ${testId()}`
  const testEmail = `test-${testId()}@example.com`

  // Cleanup after test
  test.afterEach(async () => {
    // Clean up test data from Supabase
    // Only run if test created data
    if (process.env.TEST_CLEANUP_ENABLED === 'true') {
      await cleanupTestCompany(companyName)
    }
  })

  test('CRITICAL: User can complete onboarding after payment', async ({ page }) => {
    // This is THE most important test in the entire codebase
    // If this fails, new customers cannot use the product

    test.slow() // Mark as slow test (3x timeout)

    // ============================================================
    // STEP 1: Navigate to Plan Selection
    // ============================================================
    console.log('[E2E] Step 1: Navigating to plan selection')
    await page.goto('/choose-plan')
    await expect(page).toHaveURL(/\/choose-plan/)

    // Verify page loaded
    await expect(page.locator('h1')).toContainText(/choose.*plan/i)

    // ============================================================
    // STEP 2: Select Plan and Configure Properties
    // ============================================================
    console.log('[E2E] Step 2: Selecting plan and configuring properties')

    // Select Starter plan
    await page.click('[data-testid="plan-starter"]')

    // Fill company name
    await page.fill('[data-testid="company-name"]', companyName)

    // Fill property information
    await page.fill('[data-testid="property-name-0"]', propertyName)
    await page.fill('[data-testid="site-count-0"]', '50')

    // Select billing cycle (monthly)
    await page.click('[data-testid="billing-cycle-monthly"]')

    // Click checkout button
    await page.click('[data-testid="checkout-button"]')

    // ============================================================
    // STEP 3: Complete Stripe Checkout
    // ============================================================
    console.log('[E2E] Step 3: Completing Stripe checkout')

    // Wait for redirect to Stripe
    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 10000 })

    // Fill Stripe test checkout form
    await fillStripeTestCheckout(page, {
      email: testEmail,
      card: '4242424242424242',
      expiry: '12/30',
      cvc: '123',
      zip: '12345'
    })

    // Submit payment
    await page.click('[data-test-id="hosted-payment-submit-button"]')

    console.log('[E2E] Payment submitted, waiting for webhook processing...')

    // ============================================================
    // STEP 4: Wait for Redirect to Wizard
    // ============================================================
    console.log('[E2E] Step 4: Waiting for redirect to wizard')

    // Should redirect to wizard after webhook completes
    // Webhook can take 2-10 seconds to process
    await expect(page).toHaveURL(/\/dashboard\/sites\?wizard=true/, {
      timeout: 15000 // Allow time for webhook processing
    })

    console.log('[E2E] ✓ Redirected to wizard successfully')

    // ============================================================
    // STEP 5: CRITICAL - Verify NO Redirect Loops
    // ============================================================
    console.log('[E2E] Step 5: Verifying no redirect loops (CRITICAL)')

    // Capture URL before wait
    const urlBeforeWait = page.url()
    console.log('[E2E] URL before wait:', urlBeforeWait)

    // Wait 3 seconds - URL should NOT change
    await page.waitForTimeout(3000)

    const urlAfterWait = page.url()
    console.log('[E2E] URL after wait:', urlAfterWait)

    // CRITICAL ASSERTION: URL must remain stable (no redirect loop)
    expect(urlAfterWait).toBe(urlBeforeWait)
    expect(urlAfterWait).toContain('wizard=true')

    console.log('[E2E] ✓ No redirect loops detected')

    // ============================================================
    // STEP 6: Verify Wizard Loads (Not Infinite Spinner)
    // ============================================================
    console.log('[E2E] Step 6: Verifying wizard loads')

    // Wizard should load within 5 seconds
    await expect(page.locator('[data-testid="onboarding-wizard"]')).toBeVisible({
      timeout: 5000
    })

    console.log('[E2E] ✓ Wizard loaded successfully')

    // Verify property data loaded correctly
    await expect(page.locator(`text=${propertyName}`)).toBeVisible()

    console.log('[E2E] ✓ Property data loaded correctly')

    // Verify no error messages
    await expect(page.locator('[role="alert"]')).not.toBeVisible()

    // ============================================================
    // STEP 7: Complete Wizard Steps
    // ============================================================
    console.log('[E2E] Step 7: Completing wizard steps')

    await completeWizardSteps(page, {
      propertyName,
      address: '123 Test St',
      city: 'Testville',
      state: 'CA',
      zip: '12345',
      phone: '555-0100',
      checkInTime: '14:00',
      checkOutTime: '11:00',
    })

    console.log('[E2E] ✓ All wizard steps completed')

    // ============================================================
    // STEP 8: Verify Redirect to Dashboard
    // ============================================================
    console.log('[E2E] Step 8: Verifying redirect to dashboard')

    // After completion, should redirect to main dashboard
    await expect(page).toHaveURL(/\/dashboard$/, {
      timeout: 5000
    })

    console.log('[E2E] ✓ Redirected to dashboard')

    // ============================================================
    // STEP 9: Verify Dashboard Access
    // ============================================================
    console.log('[E2E] Step 9: Verifying dashboard access')

    // Success toast should appear
    await expect(page.locator('text=/setup complete/i')).toBeVisible({
      timeout: 3000
    })

    console.log('[E2E] ✓ Setup complete toast displayed')

    // Main navigation should be visible
    await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible()

    // User should have full dashboard access
    await expect(page.locator('h1')).toContainText(/dashboard/i)

    console.log('[E2E] ✓ Dashboard fully accessible')

    // ============================================================
    // VERIFICATION COMPLETE
    // ============================================================
    console.log('[E2E] ========================================')
    console.log('[E2E] ✅ CONVERSION PIPELINE TEST PASSED')
    console.log('[E2E] ========================================')
  })
})

/**
 * Helper function to fill Stripe test checkout form
 */
async function fillStripeTestCheckout(
  page: Page,
  details: {
    email: string
    card: string
    expiry: string
    cvc: string
    zip: string
  }
) {
  console.log('[E2E] Filling Stripe checkout form')

  // Wait for Stripe iframe to load
  await page.waitForSelector('iframe[name="__privateStripeFrame"]')

  // Email field
  await page.fill('input[name="email"]', details.email)

  // Card number (in iframe)
  const cardFrame = page.frameLocator('iframe[title="Secure card number input frame"]')
  await cardFrame.locator('input[name="cardnumber"]').fill(details.card)

  // Expiry date (in iframe)
  const expiryFrame = page.frameLocator('iframe[title="Secure expiration date input frame"]')
  await expiryFrame.locator('input[name="exp-date"]').fill(details.expiry)

  // CVC (in iframe)
  const cvcFrame = page.frameLocator('iframe[title="Secure CVC input frame"]')
  await cvcFrame.locator('input[name="cvc"]').fill(details.cvc)

  // Billing zip
  await page.fill('input[name="postal"]', details.zip)

  console.log('[E2E] Stripe checkout form filled')
}

/**
 * Helper function to complete wizard steps
 */
async function completeWizardSteps(
  page: Page,
  details: {
    propertyName: string
    address: string
    city: string
    state: string
    zip: string
    phone: string
    checkInTime: string
    checkOutTime: string
  }
) {
  // Step 1: Basic Info
  console.log('[E2E] Wizard Step 1: Basic Info')
  await page.fill('[data-testid="property-address"]', details.address)
  await page.fill('[data-testid="property-city"]', details.city)
  await page.selectOption('[data-testid="property-state"]', details.state)
  await page.fill('[data-testid="property-zip"]', details.zip)
  await page.fill('[data-testid="property-phone"]', details.phone)
  await page.click('[data-testid="wizard-next-button"]')

  // Wait for next step to load
  await page.waitForTimeout(500)

  // Step 2: Site Details
  console.log('[E2E] Wizard Step 2: Site Details')
  await page.fill('[data-testid="check-in-time"]', details.checkInTime)
  await page.fill('[data-testid="check-out-time"]', details.checkOutTime)
  await page.click('[data-testid="wizard-next-button"]')

  await page.waitForTimeout(500)

  // Step 3: Pricing (optional configuration)
  console.log('[E2E] Wizard Step 3: Pricing')
  // Use default pricing
  await page.click('[data-testid="wizard-next-button"]')

  await page.waitForTimeout(500)

  // Step 4: Review & Launch
  console.log('[E2E] Wizard Step 4: Review & Launch')
  await page.click('[data-testid="wizard-complete-button"]')

  console.log('[E2E] Waiting for wizard completion...')
  await page.waitForTimeout(1000)
}
```

---

## Test 2: Wizard Access with Incomplete Onboarding

**File**: `tests/e2e/wizard-access.spec.ts`
**Duration**: ~1 minute
**Priority**: CRITICAL - Regression test for Oct 30 incident

### Test Scenario

User with paid subscription but incomplete onboarding can access wizard with `wizard=true` parameter.

### Implementation

```typescript
import { test, expect } from '@playwright/test'
import { setupUserWithSubscription, createIncompleteProperty } from '../utils/test-factories'

test.describe('Wizard Access - Incomplete Onboarding', () => {
  test('CRITICAL: Wizard accessible with incomplete onboarding', async ({ page, context }) => {
    // Setup: User with paid subscription but incomplete onboarding
    const { user, company } = await setupUserWithSubscription()
    await createIncompleteProperty(company.id)

    // Set auth cookie to log in as test user
    await context.addCookies([{
      name: 'supabase-auth-token',
      value: user.token,
      domain: 'localhost',
      path: '/',
    }])

    // Navigate directly to wizard
    await page.goto('/dashboard/sites?wizard=true')

    // Should NOT redirect to /onboarding
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/wizard=true/)

    // Wizard should load successfully
    await expect(page.locator('[data-testid="onboarding-wizard"]')).toBeVisible({
      timeout: 5000
    })

    // Verify no error messages
    await expect(page.locator('[role="alert"]')).not.toBeVisible()
  })

  test('CRITICAL: Dashboard without wizard param redirects to onboarding', async ({ page, context }) => {
    // Setup: User with paid subscription but incomplete onboarding
    const { user, company } = await setupUserWithSubscription()
    await createIncompleteProperty(company.id)

    await context.addCookies([{
      name: 'supabase-auth-token',
      value: user.token,
      domain: 'localhost',
      path: '/',
    }])

    // Navigate to dashboard WITHOUT wizard param
    await page.goto('/dashboard')

    // Should redirect to /onboarding
    await expect(page).toHaveURL(/\/onboarding/)
  })
})
```

---

## Test 3: Redirect Loop Detection

**File**: `tests/e2e/redirect-loop-detection.spec.ts`
**Duration**: ~30 seconds
**Priority**: CRITICAL - Prevent stuck users

### Test Scenario

Detect infinite redirect loops and verify circuit breaker works.

### Implementation

```typescript
import { test, expect } from '@playwright/test'
import { setupUserWithSubscription, createIncompleteProperty } from '../utils/test-factories'

test.describe('Redirect Loop Detection', () => {
  test('CRITICAL: No redirect loop with wizard=true', async ({ page, context }) => {
    const { user, company } = await setupUserWithSubscription()
    await createIncompleteProperty(company.id)

    await context.addCookies([{
      name: 'supabase-auth-token',
      value: user.token,
      domain: 'localhost',
      path: '/',
    }])

    // Track all redirects
    let redirectCount = 0
    page.on('response', (response) => {
      const status = response.status()
      if (status === 307 || status === 302 || status === 301) {
        redirectCount++
        console.log(`[Redirect ${redirectCount}]:`, response.url(), '→', response.headers()['location'])
      }
    })

    // Navigate to wizard
    await page.goto('/dashboard/sites?wizard=true')

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Should have <= 2 redirects (auth check, maybe one more)
    // More than 3 indicates infinite loop
    expect(redirectCount).toBeLessThan(3)

    // URL should be stable
    expect(page.url()).toContain('wizard=true')
  })

  test('Middleware circuit breaker prevents stuck users', async ({ page, context }) => {
    // Simulate a problematic redirect scenario
    // This test verifies the circuit breaker fires after N redirects

    // Implementation note: This requires circuit breaker to be implemented
    // in middleware with a redirect counter

    // TODO: Implement circuit breaker in middleware first
    test.skip()
  })
})
```

---

## Test 4: Wizard Navigation Flow

**File**: `tests/e2e/wizard-navigation.spec.ts`
**Duration**: ~2 minutes
**Priority**: HIGH - User experience

### Test Scenario

Complete wizard navigation including back/forward, progress saving, and error handling.

### Implementation

```typescript
import { test, expect } from '@playwright/test'
import { setupUserWithWizardAccess } from '../utils/test-factories'

test.describe('Wizard Navigation Flow', () => {
  test('User can navigate forward through all wizard steps', async ({ page, context }) => {
    const { user } = await setupUserWithWizardAccess()

    await context.addCookies([{
      name: 'supabase-auth-token',
      value: user.token,
      domain: 'localhost',
      path: '/',
    }])

    await page.goto('/dashboard/sites?wizard=true')

    // Step 1: Basic Info
    await expect(page.locator('[data-testid="wizard-step-1"]')).toBeVisible()
    await fillBasicInfo(page)
    await page.click('[data-testid="wizard-next-button"]')

    // Step 2: Site Details
    await expect(page.locator('[data-testid="wizard-step-2"]')).toBeVisible()
    await fillSiteDetails(page)
    await page.click('[data-testid="wizard-next-button"]')

    // Step 3: Pricing
    await expect(page.locator('[data-testid="wizard-step-3"]')).toBeVisible()
    await fillPricing(page)
    await page.click('[data-testid="wizard-next-button"]')

    // Step 4: Review
    await expect(page.locator('[data-testid="wizard-step-4"]')).toBeVisible()

    // Complete wizard
    await page.click('[data-testid="wizard-complete-button"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('User can navigate backward and forward without losing data', async ({ page, context }) => {
    const { user } = await setupUserWithWizardAccess()

    await context.addCookies([{
      name: 'supabase-auth-token',
      value: user.token,
      domain: 'localhost',
      path: '/',
    }])

    await page.goto('/dashboard/sites?wizard=true')

    // Fill step 1
    const testAddress = '123 Test Street'
    await page.fill('[data-testid="property-address"]', testAddress)
    await page.click('[data-testid="wizard-next-button"]')

    // Go to step 2
    await expect(page.locator('[data-testid="wizard-step-2"]')).toBeVisible()

    // Go back to step 1
    await page.click('[data-testid="wizard-back-button"]')
    await expect(page.locator('[data-testid="wizard-step-1"]')).toBeVisible()

    // Verify data persisted
    const addressValue = await page.inputValue('[data-testid="property-address"]')
    expect(addressValue).toBe(testAddress)
  })

  test('Wizard shows validation errors for required fields', async ({ page, context }) => {
    const { user } = await setupUserWithWizardAccess()

    await context.addCookies([{
      name: 'supabase-auth-token',
      value: user.token,
      domain: 'localhost',
      path: '/',
    }])

    await page.goto('/dashboard/sites?wizard=true')

    // Try to advance without filling required fields
    await page.click('[data-testid="wizard-next-button"]')

    // Should show validation errors
    await expect(page.locator('[data-testid="error-address"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-city"]')).toBeVisible()

    // Should NOT advance to next step
    await expect(page.locator('[data-testid="wizard-step-1"]')).toBeVisible()
  })
})

// Helper functions
async function fillBasicInfo(page: Page) {
  await page.fill('[data-testid="property-address"]', '123 Test St')
  await page.fill('[data-testid="property-city"]', 'Testville')
  await page.selectOption('[data-testid="property-state"]', 'CA')
  await page.fill('[data-testid="property-zip"]', '12345')
  await page.fill('[data-testid="property-phone"]', '555-0100')
}

async function fillSiteDetails(page: Page) {
  await page.fill('[data-testid="check-in-time"]', '14:00')
  await page.fill('[data-testid="check-out-time"]', '11:00')
}

async function fillPricing(page: Page) {
  // Use default pricing
  await page.click('[data-testid="use-default-pricing"]')
}
```

---

## Test Utilities

### Database Helpers

```typescript
// tests/utils/db-helpers.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function cleanupTestCompany(companyName: string) {
  // Delete company and all related data (CASCADE)
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('name', companyName)

  if (error) {
    console.error('Cleanup error:', error)
  }
}

export async function setupUserWithSubscription() {
  // Create test user with active subscription
  const testId = `test-${Date.now()}`

  const { data: user } = await supabase.auth.signUp({
    email: `${testId}@example.com`,
    password: 'test-password-123'
  })

  const { data: company } = await supabase
    .from('companies')
    .insert({
      owner_id: user!.user!.id,
      name: `Test Company ${testId}`,
      subscription_status: 'active',
      stripe_customer_id: `cus_test_${testId}`
    })
    .select()
    .single()

  return { user: user!.user!, company }
}

export async function createIncompleteProperty(companyId: string) {
  const testId = `test-${Date.now()}`

  return await supabase
    .from('properties')
    .insert({
      company_id: companyId,
      name: `Test Property ${testId}`,
      slug: `test-${testId}`,
      onboarding_completed: false,
      wizard_step_completed: null,
      wizard_progress: 0
    })
    .select()
    .single()
}
```

---

## Running E2E Tests

### Local Development

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/conversion-pipeline.spec.ts

# Run with UI mode (interactive debugging)
npx playwright test --ui

# Run headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

### CI/CD

```bash
# Run in CI mode (with retries)
CI=true npx playwright test

# Generate HTML report
npx playwright show-report
```

### Test Debugging

```bash
# View trace for failed test
npx playwright show-trace trace.zip

# Record new test
npx playwright codegen localhost:3000
```

---

## Success Criteria

E2E tests are considered complete when:

- [ ] Conversion pipeline test passes consistently (3 consecutive runs)
- [ ] Wizard access test passes with incomplete onboarding
- [ ] Redirect loop detection prevents stuck users
- [ ] Test execution time < 5 minutes total
- [ ] Screenshots captured on failure
- [ ] Video recordings available for debugging
- [ ] Tests run successfully in CI/CD
- [ ] Zero flaky tests (99%+ pass rate over 100 runs)

---

## Next Steps

1. Implement conversion pipeline E2E test first (highest priority)
2. Verify test catches the Oct 30 incident regression (manually revert fix, test should fail)
3. Add to CI/CD as blocking test
4. Implement wizard access and redirect loop tests
5. Add remaining E2E tests as time allows

---

**Related Documentation**:
- [Test Strategy](./TEST_STRATEGY.md)
- [Integration Test Specifications](./INTEGRATION_TEST_SPECIFICATIONS.md)
- [Test Utilities Design](./TEST_UTILITIES_DESIGN.md)
- [Test Implementation Guide](./TEST_IMPLEMENTATION_GUIDE.md)
