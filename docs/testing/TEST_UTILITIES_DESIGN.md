# Test Utilities Design

**Version**: 1.0
**Created**: 2025-10-31
**Priority**: HIGH - Foundation for all tests
**Estimated Implementation Time**: 8-10 hours

---

## Overview

This document specifies the design and implementation of reusable test utilities, fixtures, factories, and helpers that make writing tests faster, more consistent, and more maintainable.

**Goal**: Write once, use everywhere. Zero duplication across test files.

---

## Utility Categories

### 1. Date & Time Helpers (CRITICAL)

**File**: `tests/utils/date-helpers.ts`

**Purpose**: Generate dynamic, time-invariant test data

```typescript
/**
 * Date and time utilities for time-invariant tests
 *
 * NEVER use hardcoded dates like '2025-06-01' in tests.
 * ALWAYS use these helpers to generate dynamic dates.
 *
 * See: .claude/testing-guidelines.md for rationale
 */

/**
 * Returns date N days from now in ISO format
 * @param days Number of days in the future (positive) or past (negative)
 * @returns ISO date string (YYYY-MM-DD)
 */
export function futureDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

/**
 * Returns datetime N days from now in ISO format
 * @param days Number of days in the future
 * @returns ISO datetime string
 */
export function futureDaysTimestamp(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

/**
 * Returns the next occurrence of a specific day of the week
 * @param dayOfWeek Day name (e.g., 'monday', 'tuesday')
 * @returns ISO date string
 */
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

/**
 * Returns a date range N days from now
 * @param startDays Days until start date
 * @param endDays Days until end date
 * @returns Object with start and end ISO dates
 */
export function getDateRange(startDays: number, endDays: number) {
  return {
    start: futureDays(startDays),
    end: futureDays(endDays)
  }
}

/**
 * Returns current timestamp for "created_at" fields
 */
export function now(): string {
  return new Date().toISOString()
}

/**
 * Returns date formatted for display (MM/DD/YYYY)
 */
export function formatDisplayDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-US')
}

// Usage Examples:
// const checkIn = futureDays(7)  // 7 days from now
// const checkOut = futureDays(10) // 10 days from now
// const nextMonday = getNextDayOfWeek('monday')
```

---

### 2. ID Helpers (CRITICAL)

**File**: `tests/utils/id-helpers.ts`

**Purpose**: Generate unique, non-colliding test IDs

```typescript
/**
 * ID generation utilities for unique test identifiers
 *
 * NEVER use hardcoded IDs or sequential counters in tests.
 * ALWAYS use these helpers to generate unique IDs.
 */

/**
 * Generate unique test ID based on timestamp + random
 * Useful for names, slugs, etc.
 */
export function testId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate RFC-compliant UUID for test data
 */
export function testUUID(): string {
  return crypto.randomUUID()
}

/**
 * Generate Stripe-like test customer ID
 */
export function testStripeCustomerId(): string {
  return `cus_test_${testId()}`
}

/**
 * Generate Stripe-like test subscription ID
 */
export function testStripeSubscriptionId(): string {
  return `sub_test_${testId()}`
}

/**
 * Generate Stripe-like test event ID
 */
export function testStripeEventId(): string {
  return `evt_test_${testId()}`
}

/**
 * Generate unique email for test user
 */
export function testEmail(prefix: string = 'test'): string {
  return `${prefix}-${testId()}@example.com`
}

/**
 * Generate unique slug for test data
 */
export function testSlug(base: string): string {
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${testId()}`
}

// Usage Examples:
// const userId = testUUID()
// const email = testEmail('integration')
// const slug = testSlug('Test Property')
// const customerId = testStripeCustomerId()
```

---

### 3. Test Factories (CRITICAL)

**File**: `tests/utils/test-factories.ts`

**Purpose**: Create consistent test data with sensible defaults

```typescript
import { createClient } from '@supabase/supabase-js'
import { testId, testUUID, testEmail, testSlug } from './id-helpers'
import { now } from './date-helpers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Create test user with email verification
 */
export async function createTestUser(overrides?: {
  email?: string
  email_confirmed_at?: string | null
  metadata?: any
}) {
  const email = overrides?.email || testEmail('test')
  const password = 'test-password-123'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: overrides?.metadata || {}
    }
  })

  if (error) throw error

  // Optionally confirm email
  if (overrides?.email_confirmed_at !== null) {
    await supabase.auth.admin.updateUserById(
      data.user!.id,
      { email_confirm: true }
    )
  }

  return data.user!
}

/**
 * Create test company with active subscription
 */
export async function createTestCompany(options: {
  owner_id: string
  subscription_status?: 'active' | 'canceled' | 'incomplete'
  name?: string
}) {
  const { data, error } = await supabase
    .from('companies')
    .insert({
      owner_id: options.owner_id,
      name: options.name || `Test Company ${testId()}`,
      subscription_status: options.subscription_status || 'active',
      stripe_customer_id: testStripeCustomerId(),
      subscription_id: testStripeSubscriptionId(),
      subscription_plan: 'starter',
      billing_cycle: 'monthly',
      subscription_created_at: now()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Create test property with configurable onboarding status
 */
export async function createTestProperty(options: {
  company_id: string
  owner_id?: string
  onboarding_completed?: boolean
  wizard_step_completed?: string | null
  name?: string
  site_count?: number
}) {
  const name = options.name || `Test Property ${testId()}`

  const { data, error } = await supabase
    .from('properties')
    .insert({
      company_id: options.company_id,
      owner_id: options.owner_id || testUUID(),
      name,
      slug: testSlug(name),
      site_count: options.site_count || 50,
      onboarding_completed: options.onboarding_completed ?? false,
      wizard_step_completed: options.wizard_step_completed ?? null,
      wizard_progress: 0,
      created_at: now(),
      updated_at: now()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Complete test setup: user + company + property
 */
export async function setupUserWithSubscription() {
  const user = await createTestUser({
    email_confirmed_at: now()
  })

  const company = await createTestCompany({
    owner_id: user.id,
    subscription_status: 'active'
  })

  return { user, company }
}

/**
 * Setup user with incomplete onboarding (for wizard tests)
 */
export async function setupUserWithWizardAccess() {
  const { user, company } = await setupUserWithSubscription()

  const property = await createTestProperty({
    company_id: company.id,
    owner_id: user.id,
    onboarding_completed: false
  })

  return { user, company, property }
}

/**
 * Create test booking
 */
export async function createTestBooking(options: {
  property_id: string
  site_id: string
  check_in_days: number
  check_out_days: number
  guest_email?: string
}) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      property_id: options.property_id,
      site_id: options.site_id,
      check_in: futureDays(options.check_in_days),
      check_out: futureDays(options.check_out_days),
      guest_email: options.guest_email || testEmail('guest'),
      guest_name: 'Test Guest',
      status: 'confirmed',
      total_price: 100.00,
      created_at: now()
    })
    .select()
    .single()

  if (error) throw error
  return data
}
```

---

### 4. Database Helpers

**File**: `tests/utils/db-helpers.ts`

**Purpose**: Setup, teardown, and cleanup test data

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Clean up all test data
 * Call this in afterEach() hooks
 */
export async function cleanupTestData() {
  // Delete in order to respect foreign key constraints
  await supabase.from('bookings').delete().ilike('guest_email', '%@example.com')
  await supabase.from('sites').delete().ilike('property_id', '%')
  await supabase.from('properties').delete().ilike('slug', 'test-%')
  await supabase.from('companies').delete().ilike('name', 'Test Company%')
  await supabase.auth.admin.listUsers().then(({ data }) => {
    data.users
      .filter(u => u.email?.includes('@example.com'))
      .forEach(u => supabase.auth.admin.deleteUser(u.id))
  })
}

/**
 * Clean up specific company and all related data
 */
export async function cleanupTestCompany(companyName: string) {
  await supabase
    .from('companies')
    .delete()
    .eq('name', companyName)
}

/**
 * Verify database connection
 */
export async function verifyDatabaseConnection() {
  const { error } = await supabase.from('companies').select('count').limit(1)
  if (error) {
    throw new Error(`Database connection failed: ${error.message}`)
  }
}

/**
 * Seed test data for integration tests
 */
export async function seedTestData() {
  // Add common test data if needed
  // For now, tests create their own data via factories
}

/**
 * Execute in transaction (for fast rollback)
 */
export async function withTransaction<T>(
  fn: () => Promise<T>
): Promise<T> {
  // Supabase doesn't support transactions in client library
  // For now, use cleanup in afterEach
  // TODO: Consider using raw SQL with BEGIN/COMMIT/ROLLBACK
  return fn()
}
```

---

### 5. Stripe Test Helpers

**File**: `tests/utils/stripe-helpers.ts`

**Purpose**: Mock Stripe webhooks and test data

```typescript
import Stripe from 'stripe'
import { testId, testStripeCustomerId, testStripeSubscriptionId, testStripeEventId } from './id-helpers'

/**
 * Create mock Stripe webhook event
 */
export function createStripeWebhookEvent(
  type: Stripe.Event.Type,
  dataOverrides: any = {}
): Stripe.Event {
  const baseEvent: Stripe.Event = {
    id: testStripeEventId(),
    object: 'event',
    api_version: '2025-09-30.clover',
    created: Math.floor(Date.now() / 1000),
    type,
    data: {
      object: dataOverrides
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null
    }
  }

  return baseEvent
}

/**
 * Sign webhook event for signature verification
 * In tests, returns valid test signature
 */
export function signWebhookEvent(event: Stripe.Event): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const payload = JSON.stringify(event)

  // In real implementation, use Stripe.webhooks.generateTestHeaderString
  // For tests, return mock signature
  return `t=${timestamp},v1=test_signature_${testId()}`
}

/**
 * Create test checkout session completed event
 */
export function createCheckoutCompletedEvent(options: {
  userId: string
  planId: string
  companyName: string
  propertyName: string
  siteCount: number
}): Stripe.Event {
  return createStripeWebhookEvent('checkout.session.completed', {
    mode: 'subscription',
    customer: testStripeCustomerId(),
    subscription: testStripeSubscriptionId(),
    customer_details: {
      email: `test-${testId()}@example.com`
    },
    metadata: {
      supabase_user_id: options.userId,
      planId: options.planId,
      billingCycle: 'monthly',
      companyData: JSON.stringify({
        companyName: options.companyName,
        properties: [
          {
            name: options.propertyName,
            siteCount: options.siteCount
          }
        ]
      })
    }
  })
}

/**
 * Create test subscription created event
 */
export function createSubscriptionCreatedEvent(customerId: string): Stripe.Event {
  return createStripeWebhookEvent('customer.subscription.created', {
    customer: customerId,
    id: testStripeSubscriptionId(),
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
    items: {
      data: [
        {
          price: {
            id: 'price_test',
            recurring: { interval: 'month' }
          }
        }
      ]
    }
  })
}

/**
 * Stripe test card numbers
 */
export const STRIPE_TEST_CARDS = {
  SUCCESS: '4242424242424242',
  DECLINED: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  REQUIRES_3DS: '4000002500003155'
}
```

---

### 6. Middleware Test Helpers

**File**: `tests/utils/middleware-helpers.ts`

**Purpose**: Mock Next.js middleware requests/responses

```typescript
import { NextRequest, NextResponse } from 'next/server'

/**
 * Create mock Next.js request for middleware testing
 */
export function mockNextRequest(options: {
  pathname: string
  searchParams?: Record<string, string>
  user?: any
  cookies?: Record<string, string>
}): NextRequest {
  const url = new URL(options.pathname, 'http://localhost:3000')

  // Add search params
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const request = new NextRequest(url, {
    method: 'GET'
  })

  // Add cookies
  if (options.cookies) {
    Object.entries(options.cookies).forEach(([key, value]) => {
      request.cookies.set(key, value)
    })
  }

  // Add auth cookie if user provided
  if (options.user) {
    request.cookies.set('supabase-auth-token', JSON.stringify({
      access_token: 'test-token',
      user: options.user
    }))
  }

  return request
}

/**
 * Extract redirect location from middleware response
 */
export function getRedirectLocation(response: NextResponse): string | null {
  if (response.status === 307 || response.status === 302) {
    return response.headers.get('location')
  }
  return null
}

/**
 * Check if middleware redirected
 */
export function isRedirect(response: NextResponse): boolean {
  return response.status === 307 || response.status === 302 || response.status === 301
}

/**
 * Assert no redirect occurred
 */
export function assertNoRedirect(response: NextResponse) {
  if (isRedirect(response)) {
    throw new Error(
      `Expected no redirect, but got ${response.status} redirect to ${getRedirectLocation(response)}`
    )
  }
}

/**
 * Assert redirected to specific path
 */
export function assertRedirectTo(response: NextResponse, expectedPath: string) {
  if (!isRedirect(response)) {
    throw new Error(`Expected redirect, but got status ${response.status}`)
  }

  const location = getRedirectLocation(response)
  if (!location?.includes(expectedPath)) {
    throw new Error(
      `Expected redirect to ${expectedPath}, but got ${location}`
    )
  }
}
```

---

### 7. API Test Helpers

**File**: `tests/utils/api-helpers.ts`

**Purpose**: Mock API requests and validate responses

```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'

/**
 * Create mock API request
 */
export function mockApiRequest(options: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path?: string
  body?: any
  user?: any
  headers?: Record<string, string>
}): NextRequest {
  const url = new URL(options.path || '/api/test', 'http://localhost:3000')

  const request = new NextRequest(url, {
    method: options.method,
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (options.user) {
    request.cookies.set('supabase-auth-token', JSON.stringify({
      access_token: 'test-token',
      user: options.user
    }))
  }

  return request
}

/**
 * Validate API response against Zod schema
 */
export async function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  response: Response
): Promise<T> {
  const data = await response.json()
  return schema.parse(data)
}

/**
 * Assert API response has specific status
 */
export function assertStatusCode(response: Response, expected: number) {
  if (response.status !== expected) {
    throw new Error(
      `Expected status ${expected}, got ${response.status}`
    )
  }
}

/**
 * Extract error message from API response
 */
export async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()
    return data.error || data.message || 'Unknown error'
  } catch {
    return 'Failed to parse error response'
  }
}
```

---

## Usage Examples

### Example 1: Integration Test with Factories

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { setupUserWithSubscription, createTestProperty } from '../utils/test-factories'
import { supabase } from './setup'

describe('Properties API', () => {
  let user: any
  let company: any

  beforeEach(async () => {
    const setup = await setupUserWithSubscription()
    user = setup.user
    company = setup.company
  })

  test('returns user properties', async () => {
    // Create test property using factory
    await createTestProperty({
      company_id: company.id,
      owner_id: user.id,
      name: 'Test Property'
    })

    // Test API...
  })
})
```

### Example 2: E2E Test with Date Helpers

```typescript
import { test, expect } from '@playwright/test'
import { futureDays, getNextDayOfWeek } from '../utils/date-helpers'

test('create booking for future date', async ({ page }) => {
  await page.goto('/bookings/new')

  // Use dynamic dates
  const checkIn = getNextDayOfWeek('monday')
  const checkOut = futureDays(10)

  await page.fill('[name="check_in"]', checkIn)
  await page.fill('[name="check_out"]', checkOut)

  // Test will work regardless of when it runs
})
```

---

## Success Criteria

Test utilities are complete when:

- [ ] All utilities have clear JSDoc documentation
- [ ] All utilities have usage examples
- [ ] Zero hardcoded dates/times/IDs in utilities
- [ ] Factories create valid test data every time
- [ ] Cleanup functions remove all test data
- [ ] Utilities are used in at least 3 different test files
- [ ] Code coverage for utilities > 80%

---

**Related Documentation**:
- [Test Strategy](./TEST_STRATEGY.md)
- [E2E Test Specifications](./E2E_TEST_SPECIFICATIONS.md)
- [Integration Test Specifications](./INTEGRATION_TEST_SPECIFICATIONS.md)
