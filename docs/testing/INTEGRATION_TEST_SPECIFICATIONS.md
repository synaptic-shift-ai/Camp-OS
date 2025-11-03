# Integration Test Specifications

**Version**: 1.0
**Created**: 2025-10-31
**Priority**: CRITICAL - Required for CI/CD pipeline
**Estimated Implementation Time**: 16-20 hours

---

## Overview

This document provides detailed specifications for integration tests covering middleware logic, webhook handlers, API endpoints, and database interactions. These tests verify that multiple components work together correctly.

**Key Difference from Unit Tests**: Integration tests touch the database, call real APIs (with mocks for external services), and test component interactions.

---

## Test Environment Setup

### Vitest Configuration for Integration Tests

```typescript
// vitest.config.integration.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'integration',
    environment: 'node', // Node environment for API tests
    globals: true,
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 10000, // Longer timeout for DB operations
    hookTimeout: 30000, // Longer timeout for setup/teardown
    pool: 'forks', // Run tests in separate processes
    poolOptions: {
      forks: {
        singleFork: true // One test at a time for DB consistency
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**', 'app/api/**'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

### Integration Test Setup

```typescript
// tests/integration/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { cleanupTestData, seedTestData } from '../utils/db-helpers'

// Create Supabase test client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

beforeAll(async () => {
  console.log('[Test Setup] Starting integration test suite')
  // Verify test database connection
  const { error } = await supabase.from('companies').select('count').limit(1)
  if (error) {
    throw new Error(`Database connection failed: ${error.message}`)
  }
})

beforeEach(async () => {
  // Clean slate before each test
  await cleanupTestData()
})

afterEach(async () => {
  // Clean up after each test
  await cleanupTestData()
})

afterAll(async () => {
  console.log('[Test Setup] Integration test suite complete')
})
```

---

## Category 1: Middleware Integration Tests

### Test File: `tests/integration/middleware/wizard-access.test.ts`

**Priority**: CRITICAL - This is where the Oct 30 regression occurred

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { updateSession } from '@/lib/supabase/middleware'
import { createTestUser, createTestCompany, createTestProperty } from '../../utils/test-factories'
import { mockNextRequest, mockNextResponse } from '../../utils/middleware-helpers'
import { supabase } from '../setup'

describe('Middleware - Wizard Access Logic', () => {
  let testUser: any
  let testCompany: any

  beforeEach(async () => {
    // Setup: User with active subscription but incomplete onboarding
    testUser = await createTestUser({
      email_confirmed_at: new Date().toISOString()
    })

    testCompany = await createTestCompany({
      owner_id: testUser.id,
      subscription_status: 'active'
    })

    await createTestProperty({
      company_id: testCompany.id,
      onboarding_completed: false,
      wizard_step_completed: null
    })
  })

  test('CRITICAL: allows /dashboard when wizard=true and onboarding incomplete', async () => {
    // Regression test for Oct 30 incident

    const request = mockNextRequest({
      pathname: '/dashboard/sites',
      searchParams: { wizard: 'true' },
      user: testUser
    })

    const response = await updateSession(request)

    // Should NOT redirect
    expect(response.status).not.toBe(307)
    expect(response.status).not.toBe(302)

    // Should allow access
    expect(response.headers.get('location')).toBeNull()
  })

  test('CRITICAL: redirects /dashboard WITHOUT wizard param to /onboarding', async () => {
    // User tries to access dashboard directly without wizard param

    const request = mockNextRequest({
      pathname: '/dashboard',
      searchParams: {},
      user: testUser
    })

    const response = await updateSession(request)

    // Should redirect to onboarding
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/onboarding')
  })

  test('CRITICAL: allows /onboarding path with incomplete onboarding', async () => {
    // User navigates to /onboarding page itself

    const request = mockNextRequest({
      pathname: '/onboarding',
      searchParams: {},
      user: testUser
    })

    const response = await updateSession(request)

    // Should NOT redirect
    expect(response.status).not.toBe(307)
    expect(response.headers.get('location')).toBeNull()
  })

  test('allows /dashboard without redirect when onboarding complete', async () => {
    // Update property to complete onboarding
    await supabase
      .from('properties')
      .update({ onboarding_completed: true })
      .eq('company_id', testCompany.id)

    const request = mockNextRequest({
      pathname: '/dashboard',
      searchParams: {},
      user: testUser
    })

    const response = await updateSession(request)

    // Should NOT redirect
    expect(response.status).not.toBe(307)
    expect(response.headers.get('location')).toBeNull()
  })

  test('wizard param works on any dashboard route', async () => {
    // Test wizard=true on different dashboard paths

    const paths = [
      '/dashboard',
      '/dashboard/sites',
      '/dashboard/bookings',
      '/dashboard/settings'
    ]

    for (const pathname of paths) {
      const request = mockNextRequest({
        pathname,
        searchParams: { wizard: 'true' },
        user: testUser
      })

      const response = await updateSession(request)

      // Should NOT redirect for any dashboard route with wizard=true
      expect(response.status).not.toBe(307)
      expect(response.headers.get('location')).toBeNull()
    }
  })

  test('redirects unauthenticated users to login', async () => {
    const request = mockNextRequest({
      pathname: '/dashboard',
      searchParams: {},
      user: null // No authenticated user
    })

    const response = await updateSession(request)

    // Should redirect to login
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
    expect(response.headers.get('location')).toContain('redirect=/dashboard')
  })

  test('redirects users without subscription to plan selection', async () => {
    // Update company to have no active subscription
    await supabase
      .from('companies')
      .update({ subscription_status: 'canceled' })
      .eq('id', testCompany.id)

    const request = mockNextRequest({
      pathname: '/dashboard',
      searchParams: {},
      user: testUser
    })

    const response = await updateSession(request)

    // Should redirect to plan selection
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/choose-plan')
  })
})
```

### Test File: `tests/integration/middleware/auth-guards.test.ts`

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { updateSession } from '@/lib/supabase/middleware'
import { createTestUser } from '../../utils/test-factories'
import { mockNextRequest } from '../../utils/middleware-helpers'

describe('Middleware - Authentication Guards', () => {
  test('allows public routes without authentication', async () => {
    const publicRoutes = [
      '/',
      '/about',
      '/pricing',
      '/login',
      '/signup',
      '/choose-plan'
    ]

    for (const pathname of publicRoutes) {
      const request = mockNextRequest({
        pathname,
        searchParams: {},
        user: null
      })

      const response = await updateSession(request)

      // Should NOT redirect
      expect(response.status).not.toBe(307)
      expect(response.headers.get('location')).toBeNull()
    }
  })

  test('blocks dashboard access without authentication', async () => {
    const request = mockNextRequest({
      pathname: '/dashboard',
      searchParams: {},
      user: null
    })

    const response = await updateSession(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  test('blocks dashboard access with unverified email', async () => {
    const userWithUnverifiedEmail = await createTestUser({
      email_confirmed_at: null // Email not verified
    })

    const request = mockNextRequest({
      pathname: '/dashboard',
      searchParams: {},
      user: userWithUnverifiedEmail
    })

    const response = await updateSession(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/verify-email')
  })
})
```

---

## Category 2: Webhook Integration Tests

### Test File: `tests/integration/webhooks/checkout-completed.test.ts`

**Priority**: CRITICAL - Company creation logic

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { POST as webhookHandler } from '@/app/api/stripe/webhook/route'
import { createStripeWebhookEvent, signWebhookEvent } from '../../utils/stripe-helpers'
import { createTestUser } from '../../utils/test-factories'
import { supabase } from '../setup'
import { testId } from '../../utils/id-helpers'

describe('Webhook - Checkout Session Completed', () => {
  let testUser: any

  beforeEach(async () => {
    testUser = await createTestUser()
  })

  test('CRITICAL: creates company and properties on checkout completion', async () => {
    // Prepare webhook event
    const companyName = `Test Company ${testId()}`
    const propertyName = `Test Property ${testId()}`

    const checkoutEvent = createStripeWebhookEvent('checkout.session.completed', {
      mode: 'subscription',
      customer: `cus_test_${testId()}`,
      subscription: `sub_test_${testId()}`,
      metadata: {
        supabase_user_id: testUser.id,
        planId: 'starter',
        billingCycle: 'monthly',
        companyData: JSON.stringify({
          companyName,
          properties: [
            { name: propertyName, siteCount: 50 }
          ]
        })
      }
    })

    // Create signed webhook request
    const request = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'stripe-signature': signWebhookEvent(checkoutEvent)
      },
      body: JSON.stringify(checkoutEvent)
    })

    // Process webhook
    const response = await webhookHandler(request)

    expect(response.status).toBe(200)

    // Verify company created
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', testUser.id)
      .single()

    expect(companyError).toBeNull()
    expect(company).toBeDefined()
    expect(company.name).toBe(companyName)
    expect(company.subscription_status).toBe('active')

    // Verify properties created
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('*')
      .eq('company_id', company.id)

    expect(propertiesError).toBeNull()
    expect(properties).toHaveLength(1)
    expect(properties[0].name).toBe(propertyName)
    expect(properties[0].site_count).toBe(50)
    expect(properties[0].onboarding_completed).toBe(false)
  })

  test('handles missing metadata gracefully', async () => {
    const checkoutEvent = createStripeWebhookEvent('checkout.session.completed', {
      mode: 'subscription',
      metadata: {} // Missing required fields
    })

    const request = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'stripe-signature': signWebhookEvent(checkoutEvent)
      },
      body: JSON.stringify(checkoutEvent)
    })

    const response = await webhookHandler(request)

    // Should still return 200 (webhook acknowledged)
    expect(response.status).toBe(200)

    // Should NOT create company with incomplete data
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', testUser.id)

    expect(companies).toHaveLength(0)
  })

  test('skips non-subscription checkouts', async () => {
    const checkoutEvent = createStripeWebhookEvent('checkout.session.completed', {
      mode: 'payment', // One-time payment, not subscription
      metadata: {
        supabase_user_id: testUser.id,
        planId: 'starter'
      }
    })

    const request = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'stripe-signature': signWebhookEvent(checkoutEvent)
      },
      body: JSON.stringify(checkoutEvent)
    })

    const response = await webhookHandler(request)

    expect(response.status).toBe(200)

    // Should NOT create company for non-subscription checkout
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', testUser.id)

    expect(companies).toHaveLength(0)
  })
})
```

### Test File: `tests/integration/webhooks/race-conditions.test.ts`

**Priority**: CRITICAL - Prevents "Company not found" errors

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { POST as webhookHandler } from '@/app/api/stripe/webhook/route'
import { createStripeWebhookEvent, signWebhookEvent } from '../../utils/stripe-helpers'
import { createTestUser } from '../../utils/test-factories'
import { supabase } from '../setup'
import { testId } from '../../utils/id-helpers'

describe('Webhook - Race Condition Handling', () => {
  let testUser: any

  beforeEach(async () => {
    testUser = await createTestUser()
  })

  test('CRITICAL: handles simultaneous checkout and subscription events', async () => {
    // Simulate Stripe firing events simultaneously
    const customerId = `cus_test_${testId()}`
    const subscriptionId = `sub_test_${testId()}`

    const checkoutEvent = createStripeWebhookEvent('checkout.session.completed', {
      mode: 'subscription',
      customer: customerId,
      subscription: subscriptionId,
      metadata: {
        supabase_user_id: testUser.id,
        planId: 'starter',
        billingCycle: 'monthly',
        companyData: JSON.stringify({
          companyName: `Test Company ${testId()}`,
          properties: [{ name: 'Test Property', siteCount: 50 }]
        })
      }
    })

    const subscriptionEvent = createStripeWebhookEvent('customer.subscription.created', {
      customer: customerId,
      id: subscriptionId,
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 2592000 // 30 days
    })

    // Create webhook requests
    const checkoutRequest = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signWebhookEvent(checkoutEvent) },
      body: JSON.stringify(checkoutEvent)
    })

    const subscriptionRequest = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signWebhookEvent(subscriptionEvent) },
      body: JSON.stringify(subscriptionEvent)
    })

    // Process both webhooks simultaneously (race condition)
    const [checkoutResponse, subscriptionResponse] = await Promise.all([
      webhookHandler(checkoutRequest),
      webhookHandler(subscriptionRequest)
    ])

    // Both should succeed (no "Company not found" error)
    expect(checkoutResponse.status).toBe(200)
    expect(subscriptionResponse.status).toBe(200)

    // Verify company created with correct data
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .single()

    expect(company).toBeDefined()
    expect(company.subscription_status).toBe('active')
    expect(company.subscription_id).toBe(subscriptionId)

    // Should have exactly ONE company (not duplicates)
    const { data: allCompanies } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', testUser.id)

    expect(allCompanies).toHaveLength(1)
  })

  test('retry logic succeeds after temporary failure', async () => {
    // This test verifies the retry mechanism works

    const customerId = `cus_test_${testId()}`

    // First, manually insert a company (simulating checkout completing AFTER subscription event)
    const { data: company } = await supabase
      .from('companies')
      .insert({
        owner_id: testUser.id,
        name: `Test Company ${testId()}`,
        stripe_customer_id: customerId,
        subscription_status: 'incomplete'
      })
      .select()
      .single()

    // Now fire subscription event (should find company with retry)
    const subscriptionEvent = createStripeWebhookEvent('customer.subscription.created', {
      customer: customerId,
      id: `sub_test_${testId()}`,
      status: 'active'
    })

    const request = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signWebhookEvent(subscriptionEvent) },
      body: JSON.stringify(subscriptionEvent)
    })

    const response = await webhookHandler(request)

    expect(response.status).toBe(200)

    // Verify subscription updated
    const { data: updatedCompany } = await supabase
      .from('companies')
      .select('subscription_status')
      .eq('id', company.id)
      .single()

    expect(updatedCompany.subscription_status).toBe('active')
  })
})
```

### Test File: `tests/integration/webhooks/idempotency.test.ts`

**Priority**: HIGH - Prevents duplicate data

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { POST as webhookHandler } from '@/app/api/stripe/webhook/route'
import { createStripeWebhookEvent, signWebhookEvent } from '../../utils/stripe-helpers'
import { createTestUser } from '../../utils/test-factories'
import { supabase } from '../setup'
import { testId } from '../../utils/id-helpers'

describe('Webhook - Idempotency', () => {
  let testUser: any

  beforeEach(async () => {
    testUser = await createTestUser()
  })

  test('processing same event twice does not create duplicate company', async () => {
    const checkoutEvent = createStripeWebhookEvent('checkout.session.completed', {
      mode: 'subscription',
      customer: `cus_test_${testId()}`,
      subscription: `sub_test_${testId()}`,
      metadata: {
        supabase_user_id: testUser.id,
        planId: 'starter',
        companyData: JSON.stringify({
          companyName: `Test Company ${testId()}`,
          properties: [{ name: 'Test Property', siteCount: 50 }]
        })
      }
    })

    const request1 = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signWebhookEvent(checkoutEvent) },
      body: JSON.stringify(checkoutEvent)
    })

    const request2 = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signWebhookEvent(checkoutEvent) },
      body: JSON.stringify(checkoutEvent)
    })

    // Process same event twice (Stripe retry scenario)
    await webhookHandler(request1)
    await webhookHandler(request2)

    // Should have exactly ONE company
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', testUser.id)

    expect(companies).toHaveLength(1)
  })

  test('stores webhook event for idempotency checking', async () => {
    const eventId = `evt_test_${testId()}`

    const checkoutEvent = createStripeWebhookEvent('checkout.session.completed', {
      id: eventId,
      mode: 'subscription',
      customer: `cus_test_${testId()}`,
      metadata: {
        supabase_user_id: testUser.id,
        planId: 'starter',
        companyData: JSON.stringify({
          companyName: `Test Company ${testId()}`,
          properties: [{ name: 'Test Property', siteCount: 50 }]
        })
      }
    })

    const request = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signWebhookEvent(checkoutEvent) },
      body: JSON.stringify(checkoutEvent)
    })

    await webhookHandler(request)

    // Verify event stored in subscription_events table
    const { data: events } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('stripe_event_id', eventId)

    expect(events).toHaveLength(1)
    expect(events[0].event_type).toBe('checkout.session.completed')
  })
})
```

---

## Category 3: API Contract Tests

### Test File: `tests/integration/api/properties-api.test.ts`

**Priority**: CRITICAL - Regression test for Oct 30 incident

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { GET as propertiesHandler } from '@/app/api/onboarding/properties/route'
import { createTestUser, createTestCompany, createTestProperty } from '../../utils/test-factories'
import { mockApiRequest } from '../../utils/api-helpers'
import { z } from 'zod'

// Define expected response schema
const PropertySchema = z.object({
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
  // Add all other required fields
})

const PropertyListResponseSchema = z.object({
  properties: z.array(PropertySchema)
})

describe('Properties API - Response Contract', () => {
  let testUser: any
  let testCompany: any
  let testProperty: any

  beforeEach(async () => {
    testUser = await createTestUser()
    testCompany = await createTestCompany({ owner_id: testUser.id })
    testProperty = await createTestProperty({ company_id: testCompany.id })
  })

  test('CRITICAL: returns ALL required fields', async () => {
    // Regression test for Oct 30 incident where missing fields broke wizard

    const request = mockApiRequest({
      method: 'GET',
      user: testUser
    })

    const response = await propertiesHandler(request)
    const data = await response.json()

    // Verify response structure
    expect(data).toHaveProperty('properties')
    expect(data.properties).toBeInstanceOf(Array)
    expect(data.properties).toHaveLength(1)

    const property = data.properties[0]

    // CRITICAL: Verify all fields present
    expect(property).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String), // This was missing in incident
      name: expect.any(String),
      company_id: expect.any(String),
      owner_id: expect.any(String),
      site_count: expect.anything(),
      onboarding_completed: expect.any(Boolean),
      wizard_step_completed: expect.anything(), // This was missing in incident
      wizard_progress: expect.anything(), // This was missing in incident
      created_at: expect.any(String),
      updated_at: expect.any(String),
    })

    // Regression assertion: Fields that were missing
    expect(property.slug).toBeDefined()
    expect(property.wizard_step_completed).toBeDefined()
    expect(property.wizard_progress).toBeDefined()
  })

  test('CRITICAL: response validates against PropertyListResponseSchema', async () => {
    // Schema validation catches missing fields at runtime

    const request = mockApiRequest({
      method: 'GET',
      user: testUser
    })

    const response = await propertiesHandler(request)
    const data = await response.json()

    // Should not throw validation error
    expect(() => {
      PropertyListResponseSchema.parse(data)
    }).not.toThrow()
  })

  test('filters properties by user tenant', async () => {
    // Security: Ensure user only sees their properties

    // Create another user's property
    const otherUser = await createTestUser()
    const otherCompany = await createTestCompany({ owner_id: otherUser.id })
    await createTestProperty({ company_id: otherCompany.id })

    const request = mockApiRequest({
      method: 'GET',
      user: testUser
    })

    const response = await propertiesHandler(request)
    const data = await response.json()

    // Should only return testUser's property
    expect(data.properties).toHaveLength(1)
    expect(data.properties[0].company_id).toBe(testCompany.id)
    expect(data.properties[0].company_id).not.toBe(otherCompany.id)
  })

  test('returns empty array for user with no properties', async () => {
    // User with company but no properties yet

    const userWithNoProperties = await createTestUser()
    await createTestCompany({ owner_id: userWithNoProperties.id })

    const request = mockApiRequest({
      method: 'GET',
      user: userWithNoProperties
    })

    const response = await propertiesHandler(request)
    const data = await response.json()

    expect(data.properties).toEqual([])
  })

  test('returns 401 for unauthenticated requests', async () => {
    const request = mockApiRequest({
      method: 'GET',
      user: null // No authentication
    })

    const response = await propertiesHandler(request)

    expect(response.status).toBe(401)
  })
})
```

---

## Test Utilities

### Middleware Helpers

```typescript
// tests/utils/middleware-helpers.ts
import { NextRequest } from 'next/server'

export function mockNextRequest({
  pathname,
  searchParams,
  user,
}: {
  pathname: string
  searchParams: Record<string, string>
  user: any
}): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000')

  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const request = new NextRequest(url)

  // Mock Supabase auth in request
  if (user) {
    // Add auth cookie
    request.cookies.set('supabase-auth-token', JSON.stringify(user))
  }

  return request
}
```

### Stripe Helpers

```typescript
// tests/utils/stripe-helpers.ts
import Stripe from 'stripe'
import { testId } from './id-helpers'

export function createStripeWebhookEvent(
  type: string,
  data: any
): Stripe.Event {
  return {
    id: `evt_test_${testId()}`,
    object: 'event',
    api_version: '2025-09-30.clover',
    created: Math.floor(Date.now() / 1000),
    type,
    data: {
      object: data
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null
    }
  } as Stripe.Event
}

export function signWebhookEvent(event: Stripe.Event): string {
  // In tests, return a valid test signature
  // Real implementation would use Stripe's signature algorithm
  return `t=${Date.now()},v1=test_signature`
}
```

### API Helpers

```typescript
// tests/utils/api-helpers.ts
import { NextRequest } from 'next/server'

export function mockApiRequest({
  method,
  body,
  user,
}: {
  method: string
  body?: any
  user: any
}): NextRequest {
  const url = new URL('http://localhost:3000/api/test')

  const request = new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (user) {
    request.cookies.set('supabase-auth-token', JSON.stringify(user))
  }

  return request
}
```

---

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npx vitest run tests/integration/middleware/wizard-access.test.ts

# Run with coverage
npm run test:integration:coverage

# Watch mode
npx vitest watch tests/integration/

# Debug mode
node --inspect-brk node_modules/.bin/vitest run tests/integration/
```

---

## Success Criteria

Integration tests are considered complete when:

- [ ] All middleware logic covered (wizard access, auth guards, redirects)
- [ ] All webhook handlers covered (checkout, subscription events, race conditions)
- [ ] All critical API endpoints covered (properties, company, wizard progress)
- [ ] Tenant isolation verified for all multi-tenant features
- [ ] Test execution time < 30 seconds total
- [ ] 100% pass rate over 100 consecutive runs
- [ ] All tests independent and idempotent

---

**Related Documentation**:
- [Test Strategy](./TEST_STRATEGY.md)
- [E2E Test Specifications](./E2E_TEST_SPECIFICATIONS.md)
- [Test Utilities Design](./TEST_UTILITIES_DESIGN.md)
