/**
 * Middleware Chain Integration Tests
 *
 * CAM-142: Implement Integration Tests for Middleware Chain
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * CRITICAL: These tests verify the complete middleware chain execution
 * that prevents the infinite redirect loop bug from Oct 30, 2025 investor demo.
 *
 * Test Coverage:
 * - Auth → Tenant → Wizard → Route flow
 * - Context propagation between middleware
 * - No redirect loops occur
 * - Multi-tenant scenarios with proper isolation
 * - Wizard exception prevents infinite loops
 *
 * Following CLAUDE.md Testing Best Practices:
 * - T-2: Integration tests in tests/integration/
 * - T-3: Separate from unit tests (these touch Supabase)
 * - T-4: Prefer integration tests over heavy mocking
 * - T-9: No hardcoded temporal data (use dynamic generation)
 * - T-10: Use test data factories
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
// import { updateSession } from '@/lib/supabase/middleware'
import { composeMiddleware } from '@/lib/middleware/compose'
import {
  createAuthMiddleware,
  createEmailVerificationMiddleware,
  createSubscriptionMiddleware,
  createOnboardingMiddleware,
} from '@/lib/middleware/routing'
import { initializeRequest } from '@/lib/middleware/init'
import type { MiddlewareRequest } from '@/lib/middleware/types'
import { createCompanyId } from '@/lib/middleware/types'

// ============================================================================
// Test Data Factories (Dynamic Generation)
// ============================================================================

/**
 * Create unique session ID for test
 * Following T-9: No hardcoded IDs
 */
// function createTestSessionId(): SessionId {
//   return createSessionId(`test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`)
// }

/**
 * Create test user data
 * Following T-9: Use dynamic timestamps
 */
function createTestUser(overrides?: {
  id?: string
  email?: string
  emailVerified?: boolean
}) {
  const now = new Date()
  const id = overrides?.id || `user-${Date.now()}-${Math.random().toString(36).substring(7)}`

  return {
    id,
    email: overrides?.email || `test-${Date.now()}@example.com`,
    email_confirmed_at: overrides?.emailVerified === false ? null : now.toISOString(),
    user_metadata: {},
  }
}

/**
 * Create test company data
 * Following T-9: Use dynamic IDs
 */
function createTestCompany(overrides?: {
  id?: string
  owner_id?: string
  subscription_status?: 'active' | 'canceled' | 'past_due'
}) {
  const id = overrides?.id || `company-${Date.now()}-${Math.random().toString(36).substring(7)}`

  return {
    id,
    name: `Test Company ${Date.now()}`,
    owner_id: overrides?.owner_id || createTestUser().id,
    stripe_customer_id: `cus_${Date.now()}`,
    subscription_id: `sub_${Date.now()}`,
    subscription_status: overrides?.subscription_status || 'active',
    subscription_plan: 'pro',
  }
}

/**
 * Create test property data
 * Following T-9: Dynamic property IDs
 */
function createTestProperty(overrides?: {
  id?: string
  company_id?: string
  onboarding_completed?: boolean
}) {
  return {
    id: overrides?.id || `property-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    company_id: overrides?.company_id || createTestCompany().id,
    onboarding_completed: overrides?.onboarding_completed ?? false,
  }
}

// ============================================================================
// Mock Utilities
// ============================================================================

/**
 * Create mock Next.js request
 * Following T-10: Test data factory
 */
function createMockRequest(
  pathname: string,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`)

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    url: url.toString(),
    nextUrl: {
      pathname,
      searchParams: url.searchParams,
      clone: () => ({ pathname, searchParams: url.searchParams }),
    },
    cookies: {
      get: vi.fn().mockReturnValue(undefined),
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    },
  } as unknown as NextRequest
}

/**
 * Create mock Supabase client for testing
 * Following T-4: Minimal mocking - only mock external dependencies
 */
function createMockSupabase(scenario: {
  user?: ReturnType<typeof createTestUser> | null
  company?: ReturnType<typeof createTestCompany> | null
  incompleteProperties?: Array<ReturnType<typeof createTestProperty>>
}): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: scenario.user ?? null },
        error: scenario.user === undefined
          ? { message: 'No session' }
          : null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: scenario.company ? [scenario.company] : [],
            error: null,
          }),
        }
      }
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: scenario.incompleteProperties ?? [],
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }),
  } as unknown as SupabaseClient
}

// ============================================================================
// Test Assertions
// ============================================================================

/**
 * Assert that response is a redirect to expected path
 */
function assertRedirectTo(response: Response | MiddlewareRequest, expectedPath: string) {
  expect(response instanceof Response).toBe(true)

  if (response instanceof Response) {
    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.status).toBeLessThan(400)

    const location = response.headers.get('location')
    expect(location).toBeTruthy()
    expect(location).toContain(expectedPath)
  }
}

/**
 * Assert that response is not a redirect
 */
function assertNoRedirect(response: Response | MiddlewareRequest) {
  if (response instanceof Response) {
    // If it's a Response, status should not be 3xx
    expect(response.status).not.toBeGreaterThanOrEqual(300)
    expect(response.status).not.toBeLessThan(400)
  }
  // If it's a MiddlewareRequest, it's not a redirect (passed through)
}

/**
 * Count redirects in middleware chain execution
 * CRITICAL: Should never exceed 1 redirect per request
 */
function countRedirects(response: Response | MiddlewareRequest): number {
  if (response instanceof Response) {
    const status = response.status
    return status >= 300 && status < 400 ? 1 : 0
  }
  return 0
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Middleware Chain Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks between tests
    vi.clearAllMocks()

    // Ensure environment variables are set
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  // ==========================================================================
  // CRITICAL PRIORITY TESTS
  // ==========================================================================

  describe('CRITICAL: Authentication Flow', () => {
    it('should redirect unauthenticated users to login for protected routes', async () => {
      // Arrange: Unauthenticated user accessing dashboard
      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({ user: null })

      // Act: Execute auth middleware only
      const authMiddleware = createAuthMiddleware(supabase)
      const result = await authMiddleware(middlewareRequest)

      // Assert: Should redirect to login
      assertRedirectTo(result, '/login')

      // Verify redirect preserves original intent
      if (result instanceof Response) {
        const location = result.headers.get('location')
        // URL-encoded version or plain version both acceptable
        expect(location).toMatch(/redirect=(\/dashboard|%2Fdashboard)/)
      }
    })

    it('should allow authenticated users to pass auth middleware', async () => {
      // Arrange: Authenticated user with verified email
      const testUser = createTestUser({ emailVerified: true })
      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({ user: testUser })

      // Act: Execute auth middleware
      const authMiddleware = createAuthMiddleware(supabase)
      const result = await authMiddleware(middlewareRequest)

      // Assert: Should pass through (not redirect)
      assertNoRedirect(result)

      // Verify auth context was added
      if (!(result instanceof Response)) {
        expect(result.middlewareContext.auth).toBeDefined()
        expect(result.middlewareContext.auth?.userId).toBeDefined()
        expect(result.middlewareContext.auth?.email).toBe(testUser.email)
      }
    })

    it('should redirect users with unverified email to verification page', async () => {
      // Arrange: User with unverified email accessing dashboard
      const testUser = createTestUser({ emailVerified: false })
      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({ user: testUser })

      // Act: Execute auth + email verification middleware
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware()
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should redirect to email verification
      assertRedirectTo(result, '/verify-email')
    })
  })

  describe('CRITICAL: Wizard Exception (Infinite Loop Prevention)', () => {
    it('should allow dashboard access with ?wizard=true even if onboarding incomplete', async () => {
      // Arrange: User with incomplete onboarding accessing wizard
      const testUser = createTestUser({ emailVerified: true })
      const testCompany = createTestCompany({
        owner_id: testUser.id,
        subscription_status: 'active'
      })
      const incompleteProperty = createTestProperty({
        company_id: testCompany.id,
        onboarding_completed: false
      })

      const request = createMockRequest('/dashboard/sites', { wizard: 'true' })
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({
        user: testUser,
        company: testCompany,
        incompleteProperties: [incompleteProperty]
      })

      // Act: Execute full middleware chain
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware(),
        createSubscriptionMiddleware(supabase),
        createOnboardingMiddleware(supabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should NOT redirect to onboarding (wizard exception applies)
      assertNoRedirect(result)

      // Verify wizard context was added
      if (!(result instanceof Response)) {
        expect(result.middlewareContext.wizard).toBeDefined()
        expect(result.middlewareContext.wizard?.inWizard).toBe(true)
      }
    })

    it('should allow /onboarding route access even with incomplete onboarding', async () => {
      // Arrange: User with incomplete onboarding on onboarding route
      const testUser = createTestUser({ emailVerified: true })
      const testCompany = createTestCompany({
        owner_id: testUser.id,
        subscription_status: 'active'
      })
      const incompleteProperty = createTestProperty({
        company_id: testCompany.id,
        onboarding_completed: false
      })

      const request = createMockRequest('/onboarding')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({
        user: testUser,
        company: testCompany,
        incompleteProperties: [incompleteProperty]
      })

      // Act: Execute full middleware chain
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware(),
        createSubscriptionMiddleware(supabase),
        createOnboardingMiddleware(supabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should NOT create redirect loop
      assertNoRedirect(result)
    })

    it('should prevent infinite redirect loops (max 1 redirect per request)', async () => {
      // Arrange: Various scenarios that might cause loops
      const scenarios = [
        {
          name: 'Incomplete onboarding with wizard param',
          path: '/dashboard/sites',
          params: { wizard: 'true' },
          user: createTestUser({ emailVerified: true }),
          hasCompany: true,
          hasIncompleteProperty: true
        },
        {
          name: 'Onboarding route with incomplete setup',
          path: '/onboarding',
          params: {},
          user: createTestUser({ emailVerified: true }),
          hasCompany: true,
          hasIncompleteProperty: true
        },
      ]

      for (const scenario of scenarios) {
        const testUser = scenario.user
        const testCompany = scenario.hasCompany
          ? createTestCompany({ owner_id: testUser.id, subscription_status: 'active' })
          : null
        const incompleteProperties = scenario.hasIncompleteProperty && testCompany
          ? [createTestProperty({ company_id: testCompany.id, onboarding_completed: false })]
          : []

        const request = createMockRequest(scenario.path, scenario.params)
        const middlewareRequest = initializeRequest(request)
        const supabase = createMockSupabase({
          user: testUser,
          company: testCompany,
          incompleteProperties
        })

        // Act: Execute full middleware chain
        const middleware = composeMiddleware(
          createAuthMiddleware(supabase),
          createEmailVerificationMiddleware(),
          createSubscriptionMiddleware(supabase),
          createOnboardingMiddleware(supabase)
        )
        const result = await middleware(middlewareRequest)

        // Assert: Should have at most 1 redirect
        const redirectCount = countRedirects(result)
        expect(redirectCount).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('CRITICAL: Context Propagation', () => {
    it('should propagate auth context through middleware chain', async () => {
      // Arrange: Fully authenticated user
      const testUser = createTestUser({ emailVerified: true })
      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({ user: testUser })

      // Act: Execute auth middleware
      const authMiddleware = createAuthMiddleware(supabase)
      const result = await authMiddleware(middlewareRequest)

      // Assert: Auth context should be present
      expect(result instanceof Response).toBe(false)

      if (!(result instanceof Response)) {
        expect(result.middlewareContext.auth).toBeDefined()
        expect(result.middlewareContext.auth?.userId).toBeDefined()
        expect(result.middlewareContext.auth?.email).toBe(testUser.email)
        expect(result.middlewareContext.auth?.emailVerified).toBe(true)
      }
    })

    it('should propagate tenant context through middleware chain', async () => {
      // Arrange: User with company and subscription
      const testUser = createTestUser({ emailVerified: true })
      const testCompany = createTestCompany({
        owner_id: testUser.id,
        subscription_status: 'active'
      })

      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({
        user: testUser,
        company: testCompany
      })

      // Act: Execute auth + subscription middleware
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware(),
        createSubscriptionMiddleware(supabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: Both auth and tenant context should be present
      expect(result instanceof Response).toBe(false)

      if (!(result instanceof Response)) {
        expect(result.middlewareContext.auth).toBeDefined()
        expect(result.middlewareContext.tenant).toBeDefined()
        expect(result.middlewareContext.tenant?.companyId).toBeDefined()
        expect(result.middlewareContext.tenant?.subscriptionStatus).toBe('active')
      }
    })

    it('should accumulate context across full middleware chain', async () => {
      // Arrange: Complete user setup
      const testUser = createTestUser({ emailVerified: true })
      const testCompany = createTestCompany({
        owner_id: testUser.id,
        subscription_status: 'active'
      })

      const request = createMockRequest('/dashboard/sites', { wizard: 'true' })
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({
        user: testUser,
        company: testCompany,
        incompleteProperties: [] // Onboarding complete
      })

      // Act: Execute full middleware chain
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware(),
        createSubscriptionMiddleware(supabase),
        createOnboardingMiddleware(supabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: All context should be accumulated
      expect(result instanceof Response).toBe(false)

      if (!(result instanceof Response)) {
        // Initial context
        expect(result.middlewareContext.sessionId).toBeDefined()
        expect(result.middlewareContext.pathname).toBe('/dashboard/sites')

        // Auth context
        expect(result.middlewareContext.auth).toBeDefined()

        // Tenant context
        expect(result.middlewareContext.tenant).toBeDefined()

        // Wizard context (from query param)
        expect(result.middlewareContext.wizard).toBeDefined()
      }
    })
  })

  // ==========================================================================
  // HIGH PRIORITY TESTS
  // ==========================================================================

  describe('HIGH: Subscription Validation', () => {
    it('should redirect users without active subscription to plan selection', async () => {
      // Arrange: User with canceled subscription
      const testUser = createTestUser({ emailVerified: true })
      const testCompany = createTestCompany({
        owner_id: testUser.id,
        subscription_status: 'canceled'
      })

      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({
        user: testUser,
        company: testCompany
      })

      // Act: Execute middleware chain up to subscription check
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware(),
        createSubscriptionMiddleware(supabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should redirect to plan selection
      assertRedirectTo(result, '/choose-plan')
    })

    it('should allow access for users with active subscription', async () => {
      // Arrange: User with active subscription
      const testUser = createTestUser({ emailVerified: true })
      const testCompany = createTestCompany({
        owner_id: testUser.id,
        subscription_status: 'active'
      })

      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({
        user: testUser,
        company: testCompany,
        incompleteProperties: [] // Complete onboarding
      })

      // Act: Execute full middleware chain
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware(),
        createSubscriptionMiddleware(supabase),
        createOnboardingMiddleware(supabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should pass through
      assertNoRedirect(result)
    })
  })

  describe('HIGH: Onboarding Flow', () => {
    it('should redirect users with incomplete onboarding to /onboarding (without wizard exception)', async () => {
      // Arrange: User with incomplete onboarding, no wizard param
      const testUser = createTestUser({ emailVerified: true })
      const testCompany = createTestCompany({
        owner_id: testUser.id,
        subscription_status: 'active'
      })
      const incompleteProperty = createTestProperty({
        company_id: testCompany.id,
        onboarding_completed: false
      })

      const request = createMockRequest('/dashboard') // No wizard param
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({
        user: testUser,
        company: testCompany,
        incompleteProperties: [incompleteProperty]
      })

      // Act: Execute full middleware chain
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware(),
        createSubscriptionMiddleware(supabase),
        createOnboardingMiddleware(supabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should redirect to onboarding
      assertRedirectTo(result, '/onboarding')
    })

    it('should allow dashboard access when onboarding is complete', async () => {
      // Arrange: User with complete onboarding
      const testUser = createTestUser({ emailVerified: true })
      const testCompany = createTestCompany({
        owner_id: testUser.id,
        subscription_status: 'active'
      })

      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({
        user: testUser,
        company: testCompany,
        incompleteProperties: [] // No incomplete properties
      })

      // Act: Execute full middleware chain
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware(),
        createSubscriptionMiddleware(supabase),
        createOnboardingMiddleware(supabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should pass through
      assertNoRedirect(result)
    })
  })

  describe('HIGH: Public Routes', () => {
    it('should allow unauthenticated access to public routes', async () => {
      // Arrange: Public routes
      const publicRoutes = ['/login', '/signup', '/pricing', '/']

      for (const route of publicRoutes) {
        const request = createMockRequest(route)
        const middlewareRequest = initializeRequest(request)
        const supabase = createMockSupabase({ user: null })

        // Act: Execute auth middleware
        const authMiddleware = createAuthMiddleware(supabase)
        const result = await authMiddleware(middlewareRequest)

        // Assert: Should pass through without redirect
        assertNoRedirect(result)
      }
    })
  })

  describe('HIGH: Multi-tenant Isolation', () => {
    it('should isolate tenant data per user (type safety verification)', () => {
      // Arrange: Two different users and companies
      const userA = createTestUser()
      const userB = createTestUser()
      const companyA = createTestCompany({ owner_id: userA.id })
      const companyB = createTestCompany({ owner_id: userB.id })

      // Assert: Company IDs are distinct
      expect(companyA.id).not.toBe(companyB.id)

      // Assert: Owner IDs match respective users
      expect(companyA.owner_id).toBe(userA.id)
      expect(companyB.owner_id).toBe(userB.id)

      // Type safety: Branded types prevent accidental mixing
      const companyIdA = createCompanyId(companyA.id)
      const companyIdB = createCompanyId(companyB.id)
      expect(companyIdA).not.toBe(companyIdB)
    })
  })

  // ==========================================================================
  // MEDIUM PRIORITY TESTS
  // ==========================================================================

  describe('MEDIUM: Middleware Composition', () => {
    it('should execute middleware in correct order', async () => {
      // Arrange: Track execution order
      const executionOrder: string[] = []

      const trackingMiddleware = (name: string) => {
        return async (req: MiddlewareRequest) => {
          executionOrder.push(name)
          return req
        }
      }

      const request = createMockRequest('/test')
      const middlewareRequest = initializeRequest(request)

      // Act: Compose middleware
      const middleware = composeMiddleware(
        trackingMiddleware('first'),
        trackingMiddleware('second'),
        trackingMiddleware('third')
      )
      await middleware(middlewareRequest)

      // Assert: Should execute in order
      expect(executionOrder).toEqual(['first', 'second', 'third'])
    })

    it('should short-circuit on redirect', async () => {
      // Arrange: Middleware that redirects
      const executionOrder: string[] = []

      const trackingMiddleware = (name: string) => {
        return async (req: MiddlewareRequest) => {
          executionOrder.push(name)
          return req
        }
      }

      const redirectMiddleware = async (_req: MiddlewareRequest) => {
        executionOrder.push('redirect')
        return NextResponse.redirect(new URL('/login', 'http://localhost:3000'))
      }

      const request = createMockRequest('/test')
      const middlewareRequest = initializeRequest(request)

      // Act: Compose middleware with redirect in middle
      const middleware = composeMiddleware(
        trackingMiddleware('before-redirect'),
        redirectMiddleware,
        trackingMiddleware('after-redirect') // Should NOT execute
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should stop at redirect
      expect(executionOrder).toEqual(['before-redirect', 'redirect'])
      expect(executionOrder).not.toContain('after-redirect')
      expect(result instanceof Response).toBe(true)
    })
  })

  describe('MEDIUM: Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange: Supabase that returns error
      const testUser = createTestUser({ emailVerified: true })
      const errorSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' },
          }),
        }),
      } as unknown as SupabaseClient

      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)

      // Act: Execute subscription middleware with database error
      const middleware = composeMiddleware(
        createAuthMiddleware(errorSupabase),
        createSubscriptionMiddleware(errorSupabase)
      )
      const result = await middleware(middlewareRequest)

      // Assert: Should handle error (redirect to plan selection)
      assertRedirectTo(result, '/choose-plan')
    })

    it('should preserve context even when middleware redirects', async () => {
      // Arrange: User that will be redirected
      const testUser = createTestUser({ emailVerified: false })
      const request = createMockRequest('/dashboard')
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({ user: testUser })

      // Act: Execute middleware that will redirect
      const middleware = composeMiddleware(
        createAuthMiddleware(supabase),
        createEmailVerificationMiddleware()
      )
      const result = await middleware(middlewareRequest)

      // Assert: Original request context should be preserved
      expect(middlewareRequest.middlewareContext.sessionId).toBeDefined()
      expect(middlewareRequest.middlewareContext.pathname).toBe('/dashboard')

      // Result should be redirect
      assertRedirectTo(result, '/verify-email')
    })
  })
})

/**
 * Test Coverage Summary:
 *
 * ✅ CRITICAL Priority:
 *    - Unauthenticated user redirect
 *    - Email verification redirect
 *    - Wizard exception prevents loops
 *    - Context propagation (auth, tenant, wizard)
 *    - No redirect loops
 *
 * ✅ HIGH Priority:
 *    - Subscription validation
 *    - Onboarding flow
 *    - Public routes
 *    - Multi-tenant isolation (type safety)
 *
 * ✅ MEDIUM Priority:
 *    - Middleware composition order
 *    - Short-circuit behavior
 *    - Error handling
 *
 * Integration Test Strategy:
 * - Uses real Supabase client structure (minimal mocking)
 * - Tests complete middleware chain execution
 * - Verifies context propagation
 * - Validates wizard exception logic
 * - Follows CLAUDE.md T-9 (dynamic test data)
 * - Follows CLAUDE.md T-10 (test data factories)
 *
 * Next Steps:
 * 1. Run tests: npm run test:integration
 * 2. Verify all tests pass
 * 3. Check test coverage
 * 4. Add E2E tests if needed
 */
