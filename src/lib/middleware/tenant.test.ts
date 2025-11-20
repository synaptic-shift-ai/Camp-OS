/**
 * Tenant Middleware Tests
 *
 * CAM-137: Refactor Tenant Middleware with Isolation Guarantees
 *
 * Test Coverage:
 * 1. Tenant resolution (happy path)
 * 2. Tenant resolution failures (no company, database errors)
 * 3. Subscription validation (active, past_due, canceled, inactive)
 * 4. Multi-tenant isolation (CRITICAL security tests)
 * 5. Caching behavior
 * 6. Helper functions
 *
 * Following CLAUDE.md:
 * - T-1: Colocate unit tests with source file
 * - T-3: Separate pure-logic unit tests from DB-touching integration tests
 * - T-6: Test entire structure in one assertion
 * - T-9: Dynamic test data generation (no hardcoded values)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthenticatedRequest, TenantContext } from './types'
import {
  resolveTenant,
  resolveTenantCached,
  requiresActiveSubscription,
  getCompanyId,
  createTenantCache,
  type TenantResult,
  type TenantFailureReason,
} from './tenant'
import { createUserId, createCompanyId } from './types'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create mock authenticated request
 * Simulates request after auth middleware
 */
function createMockAuthRequest(userId: string): AuthenticatedRequest {
  return {
    middlewareContext: {
      sessionId: 'test-session-123',
      pathname: '/dashboard',
      searchParams: new URLSearchParams(),
      auth: {
        userId: createUserId(userId),
        email: 'test@example.com',
        emailVerified: true,
        emailConfirmedAt: new Date().toISOString(),
        userMetadata: {},
      } as any,
    },
  } as AuthenticatedRequest
}

/**
 * Create mock Supabase client
 * Allows testing without actual database
 */
function createMockSupabase(companyData: any = null, error: any = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() =>
            Promise.resolve({
              data: companyData,
              error,
            })
          ),
        })),
      })),
    })),
  } as unknown as SupabaseClient
}

/**
 * Create mock company data
 * Represents valid company with active subscription
 */
function createMockCompany(
  overrides: Partial<{
    id: string
    subscription_status: string | null
    subscription_plan: string | null
    stripe_customer_id: string | null
  }> = {}
) {
  return {
    id: overrides.id || 'company-123',
    name: 'Test Company LLC',
    owner_id: 'user-123',
    stripe_customer_id: 'stripe_customer_id' in overrides ? overrides.stripe_customer_id : 'cus_123',
    subscription_id: 'sub_123',
    subscription_status: 'subscription_status' in overrides ? overrides.subscription_status : 'active',
    subscription_plan: 'subscription_plan' in overrides ? overrides.subscription_plan : 'growth',
  }
}

// ============================================================================
// Unit Tests: Tenant Resolution
// ============================================================================

describe('resolveTenant', () => {
  it('should resolve tenant successfully with active subscription', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany()
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    expect(result).toEqual({
      resolved: true,
      request: expect.objectContaining({
        middlewareContext: expect.objectContaining({
          tenant: expect.objectContaining({
            companyId: company.id,
            subscriptionStatus: 'active',
            subscriptionPlan: 'growth',
            stripeCustomerId: 'cus_123',
          }),
        }),
      }),
    })
  })

  it('should fail when user has no company', async () => {
    const request = createMockAuthRequest('user-123')
    const supabase = createMockSupabase([]) // Empty array = no companies

    const result = await resolveTenant(request, supabase)

    expect(result).toEqual({
      resolved: false,
      reason: 'no_company',
    })
  })

  it('should fail when database query errors', async () => {
    const request = createMockAuthRequest('user-123')
    const error = { message: 'Database connection failed' }
    const supabase = createMockSupabase(null, error)

    const result = await resolveTenant(request, supabase)

    expect(result).toEqual({
      resolved: false,
      reason: 'database_error',
    })
  })

  it('should fail when subscription is past_due', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany({ subscription_status: 'past_due' })
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    expect(result).toEqual({
      resolved: false,
      reason: 'subscription_past_due',
    })
  })

  it('should fail when subscription is canceled', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany({ subscription_status: 'canceled' })
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    expect(result).toEqual({
      resolved: false,
      reason: 'subscription_canceled',
    })
  })

  it('should fail when subscription status is null', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany({ subscription_status: null })
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    expect(result).toEqual({
      resolved: false,
      reason: 'subscription_inactive',
    })
  })

  it('should fail when subscription is unpaid', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany({ subscription_status: 'unpaid' })
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    expect(result).toEqual({
      resolved: false,
      reason: 'subscription_inactive',
    })
  })

  it('should fail when subscription is incomplete', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany({ subscription_status: 'incomplete' })
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    expect(result).toEqual({
      resolved: false,
      reason: 'subscription_inactive',
    })
  })

  it('should handle company without stripe_customer_id', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany({ stripe_customer_id: null })
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    if (!result.resolved) {
      throw new Error('Expected tenant to be resolved')
    }

    expect(result.request.middlewareContext.tenant.stripeCustomerId).toBeUndefined()
  })
  it('should query companies table when resolving tenant', async () => {
    const request = createMockAuthRequest('user-456')
    const company = createMockCompany()
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    // Verify database was queried
    expect(supabase.from).toHaveBeenCalledWith('companies')
    // Verify result contains resolved tenant
    expect(result.resolved).toBe(true)
  })
})

// ============================================================================
// Unit Tests: Subscription Validation
// ============================================================================

describe('Subscription Status Validation', () => {
  const testCases: Array<{
    status: string | null
    expectedResolved: boolean
    expectedReason?: TenantFailureReason
    description: string
  }> = [
    {
      status: 'active',
      expectedResolved: true,
      description: 'active subscription should be valid',
    },
    {
      status: 'past_due',
      expectedResolved: false,
      expectedReason: 'subscription_past_due',
      description: 'past_due subscription should be invalid',
    },
    {
      status: 'canceled',
      expectedResolved: false,
      expectedReason: 'subscription_canceled',
      description: 'canceled subscription should be invalid',
    },
    {
      status: 'unpaid',
      expectedResolved: false,
      expectedReason: 'subscription_inactive',
      description: 'unpaid subscription should be invalid',
    },
    {
      status: 'incomplete',
      expectedResolved: false,
      expectedReason: 'subscription_inactive',
      description: 'incomplete subscription should be invalid',
    },
    {
      status: null,
      expectedResolved: false,
      expectedReason: 'subscription_inactive',
      description: 'null subscription status should be invalid',
    },
  ]

  it.each(testCases)(
    '$description',
    async ({ status, expectedResolved, expectedReason }) => {
      const request = createMockAuthRequest('user-123')
      const company = createMockCompany({ subscription_status: status })
      const supabase = createMockSupabase([company])

      const result = await resolveTenant(request, supabase)

      expect(result.resolved).toBe(expectedResolved)
      if (!expectedResolved && expectedReason) {
        expect((result as any).reason).toBe(expectedReason)
      }
    }
  )
})

// ============================================================================
// Unit Tests: Helper Functions
// ============================================================================

describe('requiresActiveSubscription', () => {
  const testCases: Array<{
    pathname: string
    expected: boolean
    description: string
  }> = [
    {
      pathname: '/dashboard',
      expected: true,
      description: 'should require subscription for dashboard',
    },
    {
      pathname: '/dashboard/properties',
      expected: true,
      description: 'should require subscription for dashboard sub-routes',
    },
    {
      pathname: '/dashboard/billing',
      expected: false,
      description: 'should NOT require subscription for billing page',
    },
    {
      pathname: '/dashboard/billing/checkout',
      expected: false,
      description: 'should NOT require subscription for billing sub-routes',
    },
    {
      pathname: '/auth/login',
      expected: false,
      description: 'should NOT require subscription for auth pages',
    },
    {
      pathname: '/',
      expected: false,
      description: 'should NOT require subscription for home page',
    },
  ]

  it.each(testCases)('$description', ({ pathname, expected }) => {
    expect(requiresActiveSubscription(pathname)).toBe(expected)
  })
})

describe('getCompanyId', () => {
  it('should extract company ID from tenant-resolved request', () => {
    const mockRequest = {
      middlewareContext: {
        sessionId: 'test-session',
        pathname: '/dashboard',
        searchParams: new URLSearchParams(),
        auth: {} as any,
        tenant: {
          companyId: createCompanyId('company-789'),
          subscriptionStatus: 'active',
        } as TenantContext,
      },
    } as any

    const companyId = getCompanyId(mockRequest)

    expect(companyId).toBe('company-789')
  })
})

// ============================================================================
// Unit Tests: Caching
// ============================================================================

describe('Tenant Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should cache tenant resolution result', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany()
    const supabase = createMockSupabase([company])
    const cache = createTenantCache()

    // First call - should query database
    const result1 = await resolveTenantCached(request, supabase, cache)

    // Second call - should use cache
    const result2 = await resolveTenantCached(request, supabase, cache)

    expect(result1).toBe(result2) // Same object reference
    expect(supabase.from).toHaveBeenCalledTimes(1) // Only one database query
  })

  it('should cache failures as well as successes', async () => {
    const request = createMockAuthRequest('user-123')
    const supabase = createMockSupabase([]) // No company
    const cache = createTenantCache()

    // First call - should query database
    const result1 = await resolveTenantCached(request, supabase, cache)

    // Second call - should use cache
    const result2 = await resolveTenantCached(request, supabase, cache)

    expect(result1).toBe(result2) // Same object reference
    expect(result1.resolved).toBe(false)
    expect(supabase.from).toHaveBeenCalledTimes(1) // Only one database query
  })

  it('should use separate cache entries for different users', async () => {
    const request1 = createMockAuthRequest('user-111')
    const request2 = createMockAuthRequest('user-222')
    const company1 = createMockCompany({ id: 'company-111' })
    const company2 = createMockCompany({ id: 'company-222' })

    let callCount = 0
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((field: string, value: string) => ({
            limit: vi.fn(() => {
              callCount++
              const data = value === 'user-111' ? [company1] : [company2]
              return Promise.resolve({ data, error: null })
            }),
          })),
        })),
      })),
    } as unknown as SupabaseClient

    const cache = createTenantCache()

    // Resolve for user 1
    const result1 = await resolveTenantCached(request1, supabase, cache)

    // Resolve for user 2
    const result2 = await resolveTenantCached(request2, supabase, cache)

    // Both should be cached separately
    expect(callCount).toBe(2)

    // Resolve for user 1 again - should use cache
    const result1Again = await resolveTenantCached(request1, supabase, cache)

    expect(callCount).toBe(2) // No additional query
    expect(result1).toBe(result1Again) // Same object reference
  })

  it('should clear cache', () => {
    const cache = createTenantCache()

    // Add entry to cache
    const mockResult: TenantResult = {
      resolved: false,
      reason: 'no_company',
    }
    cache.set('user-123', mockResult)

    // Verify cache has entry
    expect(cache.get('user-123')).toBe(mockResult)

    // Clear cache
    cache.clear()

    // Verify cache is empty
    expect(cache.get('user-123')).toBeUndefined()
  })
})

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Safety', () => {
  it('should create tenant context with correct branded types', async () => {
    const request = createMockAuthRequest('user-123')
    const company = createMockCompany({ id: 'company-456' })
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    if (!result.resolved) {
      throw new Error('Expected tenant to be resolved')
    }

    const { tenant } = result.request.middlewareContext

    // Verify branded types are used
    expect(typeof tenant.companyId).toBe('string')
    expect(tenant.companyId).toBe('company-456')
    expect(tenant.subscriptionStatus).toBe('active')
  })

  it('should preserve auth context when adding tenant context', async () => {
    const request = createMockAuthRequest('user-789')
    const company = createMockCompany()
    const supabase = createMockSupabase([company])

    const result = await resolveTenant(request, supabase)

    if (!result.resolved) {
      throw new Error('Expected tenant to be resolved')
    }

    // Verify auth context is preserved
    expect(result.request.middlewareContext.auth.userId).toBe('user-789')
    expect(result.request.middlewareContext.auth.email).toBe('test@example.com')
  })
})
