# Middleware Test Plan - CampgroundOps Platform

**Version**: 1.0
**Created**: 2025-11-01
**Issue**: CAM-134 - Design Test Strategy for Middleware
**Parent Issue**: CAM-129 - CRITICAL BUG - Middleware hardening
**Priority**: HIGH - Critical infrastructure protection
**Estimated Implementation Time**: 16-20 hours

---

## Executive Summary

This document defines comprehensive testing strategy for the CampgroundOps middleware infrastructure. The middleware is critical to the platform's security, routing, and user experience, as demonstrated by the October 30, 2025 incident where middleware changes caused complete conversion pipeline failure.

**Primary Goal**: Ensure no middleware regression can break authentication, tenant isolation, or critical user flows without immediate detection.

**Secondary Goal**: Establish systematic middleware testing patterns for all future changes.

---

## Feature Analysis

### Middleware Components Identified

Based on analysis of `E:\Projects\Saas_CampOS\middleware.ts` and `E:\Projects\Saas_CampOS\lib\supabase\middleware.ts`:

#### 1. **Authentication Middleware** (`updateSession`)
- **Purpose**: Validates user authentication via Supabase SSR
- **Critical Path**: All protected routes
- **Multi-tenant**: Yes - authenticates individual users
- **Risk Level**: CRITICAL
- **Complexity**: MEDIUM

**Key Functions**:
- `supabase.auth.getUser()` - Retrieves authenticated user
- Cookie management via Supabase SSR client
- Session validation and refresh

#### 2. **Route Protection Logic**
- **Purpose**: Enforces authentication requirements for specific routes
- **Critical Path**: Dashboard, onboarding, payment flows
- **Multi-tenant**: Yes - company/property access
- **Risk Level**: CRITICAL
- **Complexity**: HIGH

**Key Logic**:
```typescript
const requiresAuth = ["/dashboard", "/onboarding"]
const requiresSubscription = ["/dashboard", "/onboarding"]
const requiresOnboarding = ["/dashboard"]
```

#### 3. **Email Verification Gate** (Check 1.5)
- **Purpose**: Security gate requiring verified email for dashboard access
- **Critical Path**: Dashboard access
- **Multi-tenant**: N/A - user-level security
- **Risk Level**: HIGH (Security)
- **Complexity**: LOW

#### 4. **Subscription Status Validation** (Check 2)
- **Purpose**: Ensures users have active subscriptions before accessing protected routes
- **Critical Path**: Conversion pipeline, wizard access
- **Multi-tenant**: Yes - company-level validation
- **Risk Level**: CRITICAL (Revenue protection)
- **Complexity**: MEDIUM

**Database Queries**:
- Companies table query by `owner_id`
- `subscription_status` validation

#### 5. **Onboarding Completion Check** (Check 3)
- **Purpose**: Routes users to wizard if properties are incomplete
- **Critical Path**: HIGHEST - This broke in Oct 30 incident
- **Multi-tenant**: Yes - property-level validation
- **Risk Level**: CRITICAL
- **Complexity**: HIGH

**Key Logic** (REGRESSION HAPPENED HERE):
```typescript
// CRITICAL: Wizard exception logic
const isWizardOrOnboarding =
  request.nextUrl.searchParams.get("wizard") === "true" ||
  pathname.startsWith("/onboarding")

if (!isWizardOrOnboarding) {
  // Check for incomplete properties
}
```

**Database Queries**:
- Properties table query by `company_id`
- Filter: `onboarding_completed = false`

---

## Testing Strategy

### Test Pyramid Distribution

```
              /\
             /  \
            /E2E \         <- 15% (Critical flows: signup → wizard → dashboard)
           /------\
          /  INT   \       <- 35% (Middleware chains, DB queries, redirects)
         /----------\
        /    UNIT    \     <- 50% (Pure logic, route matching, URL parsing)
       /--------------\
```

### Coverage Goals

| Component | Unit Tests | Integration Tests | E2E Tests | Security Tests | Target Coverage |
|-----------|-----------|-------------------|-----------|----------------|-----------------|
| Authentication validation | 80% | 100% | 100% | 100% | CRITICAL |
| Route protection logic | 90% | 100% | 80% | N/A | CRITICAL |
| Email verification gate | 90% | 100% | 50% | 80% | HIGH |
| Subscription validation | 80% | 100% | 100% | 100% | CRITICAL |
| Onboarding completion check | 100% | 100% | 100% | 100% | CRITICAL (Regression site) |
| Wizard exception logic | 100% | 100% | 100% | N/A | CRITICAL (Broke in incident) |
| Cookie management | 60% | 80% | 50% | N/A | MEDIUM |

### Multi-Tenant Security

**CRITICAL**: Every middleware function that queries company or property data MUST have tenant isolation tests.

**Tenant Isolation Points**:
1. Company query by `owner_id` - User A cannot access Company B
2. Properties query by `company_id` - User A cannot see Property B's onboarding status
3. Wizard access - User A with incomplete property should not affect User B

---

## Test Scenarios (Prioritized)

### Priority: CRITICAL (Must Have Before Deploy)

#### Scenario 1: Wizard Access with Incomplete Onboarding (REGRESSION TEST)
**Type**: Integration + E2E
**Description**: User with incomplete onboarding CAN access wizard with `?wizard=true`
**Expected**: No redirect, wizard loads successfully
**Test Data**: Dynamic user, company with active subscription, property with `onboarding_completed=false`
**Regression Coverage**: October 30, 2025 incident

**Test Cases**:
1. `/dashboard?wizard=true` with incomplete onboarding → Allow (200)
2. `/dashboard/sites?wizard=true&step=property_details` with incomplete onboarding → Allow (200)
3. `/dashboard` (no wizard param) with incomplete onboarding → Redirect to `/onboarding` (307)
4. `/onboarding` with incomplete onboarding → Allow (200)

**Integration Test** (`tests/integration/middleware/wizard-access.test.ts`):
```typescript
describe('Wizard Access Logic', () => {
  test('allows dashboard access with wizard=true and incomplete onboarding', async () => {
    const { user, company, property } = await setupUserWithWizardAccess()

    const request = mockNextRequest({
      pathname: '/dashboard',
      searchParams: { wizard: 'true' },
      user
    })

    const response = await updateSession(request)

    expect(response.status).toBe(200)
    assertNoRedirect(response)
  })

  test('redirects dashboard without wizard param when onboarding incomplete', async () => {
    const { user, company, property } = await setupUserWithWizardAccess()

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    const response = await updateSession(request)

    assertRedirectTo(response, '/onboarding')
  })
})
```

**E2E Test** (`tests/e2e/wizard-access.spec.ts`):
```typescript
test('user can access wizard with incomplete onboarding', async ({ page }) => {
  const { user, property } = await setupTestUserWithIncompleteProperty()

  await loginAs(page, user)

  // Navigate to wizard (should NOT redirect to /onboarding)
  await page.goto('/dashboard?wizard=true')

  await expect(page).toHaveURL(/wizard=true/)
  await expect(page.locator('[data-testid="wizard-container"]')).toBeVisible()
})
```

---

#### Scenario 2: Unauthenticated User Redirected to Login
**Type**: Integration + E2E
**Description**: Unauthenticated user accessing protected route redirects to login
**Expected**: Redirect to `/login` with `redirect` query param
**Test Data**: No user session

**Test Cases**:
1. Unauthenticated `/dashboard` → Redirect to `/login?redirect=/dashboard`
2. Unauthenticated `/onboarding` → Redirect to `/login?redirect=/onboarding`
3. Unauthenticated public route (if any) → Allow

**Integration Test** (`tests/integration/middleware/auth-guards.test.ts`):
```typescript
describe('Authentication Guards', () => {
  test('redirects unauthenticated user to login', async () => {
    const request = mockNextRequest({
      pathname: '/dashboard',
      user: null // No authenticated user
    })

    const response = await updateSession(request)

    expect(response.status).toBe(307)
    const location = getRedirectLocation(response)
    expect(location).toContain('/login')
    expect(location).toContain('redirect=/dashboard')
  })

  test.each([
    '/dashboard',
    '/dashboard/sites',
    '/onboarding',
    '/onboarding/wizard'
  ])('protects route %s from unauthenticated access', async (pathname) => {
    const request = mockNextRequest({ pathname, user: null })
    const response = await updateSession(request)

    assertRedirectTo(response, '/login')
  })
})
```

---

#### Scenario 3: Unverified Email Blocked from Dashboard
**Type**: Integration + Security
**Description**: User with unverified email cannot access dashboard
**Expected**: Redirect to `/verify-email` with redirect param
**Test Data**: User with `email_confirmed_at = null`

**Test Cases**:
1. Unverified email accessing `/dashboard` → Redirect to `/verify-email?redirect=/dashboard`
2. Verified email accessing `/dashboard` with active subscription → Allow

**Integration Test** (`tests/integration/middleware/email-verification.test.ts`):
```typescript
describe('Email Verification Gate', () => {
  test('redirects user with unverified email to verification page', async () => {
    const user = await createTestUser({
      email_confirmed_at: null // Unverified
    })

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    const response = await updateSession(request)

    assertRedirectTo(response, '/verify-email')
    expect(getRedirectLocation(response)).toContain('redirect=/dashboard')
  })

  test('allows verified email to access dashboard', async () => {
    const { user, company } = await setupUserWithSubscription()

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    const response = await updateSession(request)

    // Should not redirect to verify-email (may redirect for other reasons)
    expect(getRedirectLocation(response)).not.toContain('/verify-email')
  })
})
```

**Security Test** (`tests/security/email-verification.test.ts`):
```typescript
test('unverified email cannot bypass verification by accessing nested routes', async () => {
  const user = await createTestUser({ email_confirmed_at: null })

  const nestedRoutes = [
    '/dashboard',
    '/dashboard/sites',
    '/dashboard/bookings',
    '/dashboard/settings'
  ]

  for (const pathname of nestedRoutes) {
    const request = mockNextRequest({ pathname, user })
    const response = await updateSession(request)

    assertRedirectTo(response, '/verify-email')
  }
})
```

---

#### Scenario 4: No Active Subscription Redirected to Plan Selection
**Type**: Integration + E2E
**Description**: User without active subscription redirected to choose plan
**Expected**: Redirect to `/choose-plan` unless already on payment pages
**Test Data**: Company with `subscription_status != 'active'`

**Test Cases**:
1. No company found → Redirect to `/choose-plan`
2. Company with `subscription_status = 'canceled'` → Redirect to `/choose-plan`
3. Company with `subscription_status = 'active'` → Allow dashboard access
4. Already on `/choose-plan` or `/payment` → No redirect (prevent loop)

**Integration Test** (`tests/integration/middleware/subscription-validation.test.ts`):
```typescript
describe('Subscription Validation', () => {
  test('redirects user without company to plan selection', async () => {
    const user = await createTestUser({ email_confirmed_at: now() })
    // No company created for this user

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    const response = await updateSession(request)

    assertRedirectTo(response, '/choose-plan')
  })

  test('redirects user with canceled subscription to plan selection', async () => {
    const user = await createTestUser({ email_confirmed_at: now() })
    await createTestCompany({
      owner_id: user.id,
      subscription_status: 'canceled'
    })

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    const response = await updateSession(request)

    assertRedirectTo(response, '/choose-plan')
  })

  test('allows dashboard access with active subscription', async () => {
    const { user, company } = await setupUserWithSubscription()
    await createTestProperty({
      company_id: company.id,
      owner_id: user.id,
      onboarding_completed: true // Complete onboarding
    })

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    const response = await updateSession(request)

    expect(response.status).toBe(200)
    assertNoRedirect(response)
  })

  test('does not redirect when already on payment pages', async () => {
    const user = await createTestUser({ email_confirmed_at: now() })
    // No company (would normally redirect)

    const paymentRoutes = ['/choose-plan', '/payment']

    for (const pathname of paymentRoutes) {
      const request = mockNextRequest({ pathname, user })
      const response = await updateSession(request)

      // Should NOT redirect (prevent infinite loop)
      assertNoRedirect(response)
    }
  })
})
```

---

#### Scenario 5: Tenant Isolation - User Cannot Access Another Company's Data
**Type**: Security (CRITICAL for multi-tenant)
**Description**: Middleware queries ensure User A cannot see Company B's subscription status
**Expected**: Each user only sees their own company data
**Test Data**: Two separate users with separate companies

**Security Test** (`tests/security/tenant-isolation-middleware.test.ts`):
```typescript
describe('Tenant Isolation - Middleware', () => {
  test('user A cannot trigger redirects based on user B company status', async () => {
    // Create two separate tenants
    const { user: userA, company: companyA } = await setupUserWithSubscription()
    await createTestProperty({
      company_id: companyA.id,
      owner_id: userA.id,
      onboarding_completed: true
    })

    const { user: userB, company: companyB } = await setupUserWithSubscription()
    // Company B has canceled subscription
    await supabase
      .from('companies')
      .update({ subscription_status: 'canceled' })
      .eq('id', companyB.id)

    // User A should still access dashboard (their company is active)
    const requestA = mockNextRequest({
      pathname: '/dashboard',
      user: userA
    })

    const responseA = await updateSession(requestA)

    // Should NOT redirect to /choose-plan
    expect(getRedirectLocation(responseA)).not.toContain('/choose-plan')

    // User B should be redirected (their company is canceled)
    const requestB = mockNextRequest({
      pathname: '/dashboard',
      user: userB
    })

    const responseB = await updateSession(requestB)

    assertRedirectTo(responseB, '/choose-plan')
  })

  test('user A incomplete onboarding does not affect user B', async () => {
    const { user: userA, company: companyA } = await setupUserWithSubscription()
    await createTestProperty({
      company_id: companyA.id,
      owner_id: userA.id,
      onboarding_completed: false // Incomplete
    })

    const { user: userB, company: companyB } = await setupUserWithSubscription()
    await createTestProperty({
      company_id: companyB.id,
      owner_id: userB.id,
      onboarding_completed: true // Complete
    })

    // User A redirected to onboarding
    const requestA = mockNextRequest({
      pathname: '/dashboard',
      user: userA
    })
    const responseA = await updateSession(requestA)
    assertRedirectTo(responseA, '/onboarding')

    // User B allowed to dashboard
    const requestB = mockNextRequest({
      pathname: '/dashboard',
      user: userB
    })
    const responseB = await updateSession(requestB)
    assertNoRedirect(responseB)
  })
})
```

---

### Priority: HIGH (Should Have)

#### Scenario 6: Redirect Loop Prevention (Circuit Breaker)
**Type**: Integration
**Description**: Middleware prevents infinite redirect loops
**Expected**: After N redirects, break loop or log error
**Test Data**: Conflicting redirect conditions

**Test Cases**:
1. No infinite loops between `/dashboard` and `/onboarding`
2. No infinite loops between `/dashboard` and `/choose-plan`
3. Wizard exception prevents `/onboarding` → `/dashboard?wizard=true` → `/onboarding` loop

**Integration Test** (`tests/integration/middleware/redirect-loop-prevention.test.ts`):
```typescript
describe('Redirect Loop Prevention', () => {
  test('wizard parameter prevents onboarding redirect loop', async () => {
    const { user, company, property } = await setupUserWithWizardAccess()

    // Simulate accessing wizard multiple times
    const iterations = 5

    for (let i = 0; i < iterations; i++) {
      const request = mockNextRequest({
        pathname: '/dashboard',
        searchParams: { wizard: 'true' },
        user
      })

      const response = await updateSession(request)

      // Should NEVER redirect to /onboarding with wizard=true
      expect(getRedirectLocation(response)).not.toContain('/onboarding')
      expect(response.status).toBe(200)
    }
  })

  test('payment pages do not redirect to themselves', async () => {
    const user = await createTestUser({ email_confirmed_at: now() })
    // No company (would trigger redirect to /choose-plan)

    const request = mockNextRequest({
      pathname: '/choose-plan',
      user
    })

    const response = await updateSession(request)

    // Should NOT redirect to /choose-plan again
    expect(getRedirectLocation(response)).not.toBe('/choose-plan')
  })
})
```

---

#### Scenario 7: Database Query Optimization (Performance)
**Type**: Performance
**Description**: Middleware executes minimal database queries
**Expected**: Max 2 DB queries per request (user + company/properties)
**Test Data**: Standard authenticated user

**Performance Test** (`tests/performance/middleware-queries.test.ts`):
```typescript
describe('Middleware Query Optimization', () => {
  test('executes maximum 2 database queries per request', async () => {
    const { user, company } = await setupUserWithSubscription()
    await createTestProperty({
      company_id: company.id,
      owner_id: user.id,
      onboarding_completed: true
    })

    // Spy on Supabase queries
    const querySpy = vi.spyOn(supabase, 'from')

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    await updateSession(request)

    // Should query:
    // 1. auth.getUser() - handled by Supabase client
    // 2. companies table - .eq('owner_id', user.id)
    // 3. properties table - .eq('company_id', company.id) (only if onboarding check needed)

    expect(querySpy).toHaveBeenCalledTimes(2)
  })
})
```

---

#### Scenario 8: Multiple Incomplete Properties
**Type**: Integration
**Description**: User with multiple properties, some incomplete
**Expected**: Redirect to onboarding if ANY property is incomplete
**Test Data**: User with 2 properties, 1 complete, 1 incomplete

**Integration Test** (`tests/integration/middleware/multiple-properties.test.ts`):
```typescript
describe('Multiple Properties Handling', () => {
  test('redirects if any property has incomplete onboarding', async () => {
    const { user, company } = await setupUserWithSubscription()

    // Property 1: Complete
    await createTestProperty({
      company_id: company.id,
      owner_id: user.id,
      name: 'Complete Property',
      onboarding_completed: true
    })

    // Property 2: Incomplete
    await createTestProperty({
      company_id: company.id,
      owner_id: user.id,
      name: 'Incomplete Property',
      onboarding_completed: false
    })

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    const response = await updateSession(request)

    // Should redirect because at least one property is incomplete
    assertRedirectTo(response, '/onboarding')
  })

  test('allows dashboard when all properties are complete', async () => {
    const { user, company } = await setupUserWithSubscription()

    await createTestProperty({
      company_id: company.id,
      owner_id: user.id,
      onboarding_completed: true
    })

    await createTestProperty({
      company_id: company.id,
      owner_id: user.id,
      onboarding_completed: true
    })

    const request = mockNextRequest({
      pathname: '/dashboard',
      user
    })

    const response = await updateSession(request)

    assertNoRedirect(response)
  })
})
```

---

### Priority: MEDIUM (Nice to Have)

#### Scenario 9: Cookie Management and Session Refresh
**Type**: Integration
**Description**: Middleware properly manages Supabase auth cookies
**Expected**: Cookies are refreshed and set correctly
**Test Data**: Authenticated user with expiring session

**Test**: Validate cookies are set in response headers

---

#### Scenario 10: Route Matching Edge Cases
**Type**: Unit
**Description**: Route matching works for nested and wildcard paths
**Expected**: Correct boolean flags for `needsAuth`, `needsSubscription`, etc.
**Test Data**: Various pathname patterns

**Unit Test** (`tests/unit/middleware/route-matching.test.ts`):
```typescript
describe('Route Matching Logic', () => {
  test.each([
    { pathname: '/dashboard', expectedAuth: true, expectedSub: true, expectedOnboarding: true },
    { pathname: '/dashboard/sites', expectedAuth: true, expectedSub: true, expectedOnboarding: true },
    { pathname: '/onboarding', expectedAuth: true, expectedSub: true, expectedOnboarding: false },
    { pathname: '/login', expectedAuth: false, expectedSub: false, expectedOnboarding: false },
    { pathname: '/choose-plan', expectedAuth: false, expectedSub: false, expectedOnboarding: false }
  ])('route $pathname requires auth=$expectedAuth, subscription=$expectedSub, onboarding=$expectedOnboarding',
    ({ pathname, expectedAuth, expectedSub, expectedOnboarding }) => {
      const requiresAuth = ["/dashboard", "/onboarding"]
      const requiresSubscription = ["/dashboard", "/onboarding"]
      const requiresOnboarding = ["/dashboard"]

      const needsAuth = requiresAuth.some((route) => pathname.startsWith(route))
      const needsSubscription = requiresSubscription.some((route) => pathname.startsWith(route))
      const needsOnboardingComplete = requiresOnboarding.some((route) => pathname.startsWith(route))

      expect(needsAuth).toBe(expectedAuth)
      expect(needsSubscription).toBe(expectedSub)
      expect(needsOnboardingComplete).toBe(expectedOnboarding)
  })
})
```

---

## E2E Test Scenarios (Critical User Flows)

### E2E Flow 1: New User Signup → Wizard → Dashboard
**File**: `tests/e2e/conversion-pipeline-middleware.spec.ts`
**Description**: Complete conversion pipeline ensuring middleware allows proper flow
**Steps**:
1. User signs up and verifies email
2. User completes payment (webhook creates company)
3. Middleware allows access to wizard with `?wizard=true`
4. User completes wizard
5. Middleware allows dashboard access (onboarding complete)

**Critical Validations**:
- No redirect loops during wizard
- Subscription validation passes after webhook
- Onboarding completion check works correctly

```typescript
test('complete conversion pipeline with middleware validation', async ({ page }) => {
  // 1. Signup
  const user = await createTestUser()
  await loginAs(page, user)

  // 2. Payment (webhook creates company in background)
  await completeMockPayment(page, user)

  // 3. Middleware should allow wizard access
  await page.goto('/dashboard?wizard=true')
  await expect(page).toHaveURL(/wizard=true/)

  // 4. Complete wizard steps
  await completeWizardSteps(page)

  // 5. Middleware should now allow dashboard (onboarding complete)
  await page.goto('/dashboard')
  await expect(page).not.toHaveURL(/onboarding/)
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
})
```

---

### E2E Flow 2: Existing User Login → Dashboard Access
**File**: `tests/e2e/returning-user-middleware.spec.ts`
**Description**: Returning user with complete onboarding accesses dashboard directly

---

### E2E Flow 3: User Without Subscription Blocked
**File**: `tests/e2e/subscription-gate-middleware.spec.ts`
**Description**: User whose subscription expired is redirected to plan selection

---

## Test Utilities Needed

### Middleware-Specific Test Helpers

**File**: `tests/utils/middleware-helpers.ts`

Already designed in [TEST_UTILITIES_DESIGN.md](../../docs/testing/TEST_UTILITIES_DESIGN.md), key functions:
- `mockNextRequest()` - Create mock Next.js request
- `getRedirectLocation()` - Extract redirect URL
- `isRedirect()` - Check if response is redirect
- `assertNoRedirect()` - Assert no redirect occurred
- `assertRedirectTo()` - Assert redirect to specific path

### Additional Utilities for Middleware Tests

```typescript
/**
 * Create authenticated request with specific user state
 */
export function mockAuthenticatedRequest(options: {
  pathname: string
  user: User
  emailVerified?: boolean
  searchParams?: Record<string, string>
}): NextRequest {
  const user = {
    ...options.user,
    email_confirmed_at: options.emailVerified !== false ? now() : null
  }

  return mockNextRequest({
    pathname: options.pathname,
    searchParams: options.searchParams,
    user
  })
}

/**
 * Spy on Supabase database queries
 */
export function createSupabaseSpy() {
  const queries: Array<{ table: string; operation: string }> = []

  const spy = vi.spyOn(supabase, 'from').mockImplementation((table) => {
    queries.push({ table, operation: 'select' })
    return realSupabase.from(table)
  })

  return { spy, queries }
}

/**
 * Simulate multiple middleware redirects to detect loops
 */
export async function detectRedirectLoop(
  initialRequest: NextRequest,
  maxIterations: number = 10
): Promise<{ loopDetected: boolean; redirectChain: string[] }> {
  const redirectChain: string[] = []
  let request = initialRequest

  for (let i = 0; i < maxIterations; i++) {
    const response = await updateSession(request)

    if (!isRedirect(response)) {
      return { loopDetected: false, redirectChain }
    }

    const location = getRedirectLocation(response)!
    redirectChain.push(location)

    // Check if we've seen this location before (loop)
    if (redirectChain.filter(l => l === location).length > 1) {
      return { loopDetected: true, redirectChain }
    }

    // Create new request for next iteration
    request = mockNextRequest({
      pathname: new URL(location, 'http://localhost').pathname,
      user: request.cookies.get('supabase-auth-token')
    })
  }

  return { loopDetected: true, redirectChain }
}
```

---

## Mock Strategies

### 1. Supabase Auth Mocking (Unit Tests)

**Strategy**: Mock `supabase.auth.getUser()` to return test user data

```typescript
import { vi } from 'vitest'

// Mock Supabase client
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUser },
        error: null
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: mockCompany, error: null })),
      limit: vi.fn(async () => ({ data: [], error: null }))
    }))
  }))
}))
```

**When to Use**:
- Unit tests testing pure middleware logic
- Fast feedback tests not requiring real database

**When NOT to Use**:
- Integration tests (use real Supabase local instance)
- Security tests (must validate real DB queries)

---

### 2. Database Mocking (Integration Tests)

**Strategy**: Use Supabase local instance with transaction rollback

```typescript
import { beforeEach, afterEach } from 'vitest'
import { supabase } from './setup'

describe('Middleware Integration Tests', () => {
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    // Setup test data using factories
    const setup = await setupUserWithSubscription()
    cleanup = async () => {
      await cleanupTestData()
    }
  })

  afterEach(async () => {
    await cleanup()
  })
})
```

**When to Use**:
- Integration tests validating DB queries
- Security tests for tenant isolation
- Tests requiring realistic data state

---

### 3. Next.js Request/Response Mocking

**Strategy**: Use custom mock functions (defined in middleware-helpers.ts)

```typescript
const request = mockNextRequest({
  pathname: '/dashboard',
  searchParams: { wizard: 'true' },
  user: testUser
})

const response = await updateSession(request)
```

**When to Use**:
- All middleware tests (unit and integration)
- Testing route matching and redirect logic

---

### 4. Cookie Mocking

**Strategy**: Mock Next.js cookie API

```typescript
const mockCookies = {
  getAll: vi.fn(() => [
    { name: 'supabase-auth-token', value: 'test-token' }
  ]),
  set: vi.fn(),
  get: vi.fn()
}
```

**When to Use**:
- Testing session refresh logic
- Testing cookie-based auth state

---

## Test Execution Strategy

### Local Development

```bash
# Run all middleware tests
npm run test tests/middleware

# Run specific test file
npm run test tests/integration/middleware/wizard-access.test.ts

# Run in watch mode (TDD)
npm run test:watch tests/middleware

# Run with coverage
npm run test:coverage tests/middleware
```

### CI/CD Pipeline

```yaml
# .github/workflows/test-middleware.yml
name: Middleware Tests

on:
  pull_request:
    paths:
      - 'middleware.ts'
      - 'lib/supabase/middleware.ts'
      - 'tests/middleware/**'
  push:
    branches: [main]

jobs:
  test-middleware:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: npm ci
      - run: npm run test:ci -- tests/middleware
      - run: npm run test:e2e -- tests/e2e/*middleware*.spec.ts
```

**Deployment Gate**: ALL middleware tests MUST pass before deploy.

---

## Success Criteria

This test plan is complete when:

- [ ] All CRITICAL scenarios have passing tests (100% coverage)
- [ ] All HIGH scenarios have passing tests (80%+ coverage)
- [ ] Regression test for Oct 30 incident implemented and passing
- [ ] Tenant isolation tests implemented for all multi-tenant queries
- [ ] E2E conversion pipeline test passes end-to-end
- [ ] Test utilities implemented and documented
- [ ] Mock strategies validated in at least 3 test files
- [ ] CI/CD pipeline runs middleware tests on every PR
- [ ] Zero flaky tests (pass rate > 99%)
- [ ] Test execution time < 30 seconds (unit + integration)
- [ ] E2E tests complete in < 5 minutes

---

## Delegation Plan

### Specialized Test Agents

#### 1. **Unit Test Agent**
**Scenarios**: Route matching edge cases (Scenario 10)
**Context**: Pure logic testing, no database or auth required
**Deliverable**: `tests/unit/middleware/route-matching.test.ts`

#### 2. **Integration Test Agent**
**Scenarios**:
- Wizard access logic (Scenario 1)
- Auth guards (Scenario 2)
- Email verification (Scenario 3)
- Subscription validation (Scenario 4)
- Redirect loop prevention (Scenario 6)
- Multiple properties (Scenario 8)

**Context**: Database queries, Supabase integration, middleware chains
**Deliverable**: All files in `tests/integration/middleware/`

#### 3. **Security Test Agent**
**Scenarios**: Tenant isolation (Scenario 5), Email verification bypass attempts (Scenario 3)
**Context**: Multi-tenant data isolation, security boundaries
**Deliverable**: `tests/security/tenant-isolation-middleware.test.ts`, `tests/security/email-verification.test.ts`

#### 4. **E2E Test Agent**
**Scenarios**: E2E Flows 1-3
**Context**: Complete user journeys using Playwright
**Deliverable**: All files in `tests/e2e/*middleware*.spec.ts`

#### 5. **Performance Test Agent**
**Scenarios**: Database query optimization (Scenario 7)
**Context**: Performance budgets, query counting
**Deliverable**: `tests/performance/middleware-queries.test.ts`

---

## Risk Assessment

### High-Risk Areas (Prioritize Testing)

1. **Wizard exception logic** (Lines 85-104 in middleware.ts)
   - **Risk**: Regression broke this in Oct 30 incident
   - **Mitigation**: 100% test coverage, E2E validation

2. **Database queries for tenant data**
   - **Risk**: Tenant data leakage if `owner_id`/`company_id` filters fail
   - **Mitigation**: Security tests for every multi-tenant query

3. **Redirect logic interactions**
   - **Risk**: Infinite loops, broken user flows
   - **Mitigation**: Loop detection tests, E2E flow validation

4. **Cookie management**
   - **Risk**: Session loss, auth failures
   - **Mitigation**: Integration tests for session refresh

---

## Related Documentation

- [Test Strategy](../../docs/testing/TEST_STRATEGY.md)
- [Test Utilities Design](../../docs/testing/TEST_UTILITIES_DESIGN.md)
- [E2E Test Specifications](../../docs/testing/E2E_TEST_SPECIFICATIONS.md)
- [Integration Test Specifications](../../docs/testing/INTEGRATION_TEST_SPECIFICATIONS.md)
- [Incident Summary](../../docs/reference/INCIDENT_SUMMARY_2025_10_30.md)

---

## Next Steps

1. **Review this plan** with team for feedback
2. **Implement test utilities** (middleware-helpers.ts)
3. **Start with CRITICAL scenarios** (Scenarios 1-5)
4. **Set up CI/CD gates** for middleware tests
5. **Implement E2E conversion pipeline test**
6. **Document lessons learned** as tests catch issues

---

**Document Owner**: Test Architect
**Reviewers**: Backend Team, QA Lead
**Implementation Start**: 2025-11-01
**Target Completion**: 2025-11-08 (1 week sprint)
**Last Updated**: 2025-11-01
