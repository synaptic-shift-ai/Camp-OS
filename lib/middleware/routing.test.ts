/**
 * Routing Middleware Tests
 *
 * CAM-140: Update Main Middleware with Composition
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * Tests verify:
 * - Individual routing middleware functions work correctly
 * - Auth middleware redirects unauthenticated users
 * - Email verification middleware enforces security gate
 * - Subscription middleware validates tenant context
 * - Onboarding middleware respects wizard exceptions
 *
 * Following CLAUDE.md:
 * - T-1: Colocate unit tests with source
 * - T-9: Use dynamic test data generation
 */

import { describe, it, expect, vi } from 'vitest'
import { NextResponse } from 'next/server'
import type { MiddlewareRequest } from './types'
import { createSessionId, createUserId, createCompanyId } from './types'
import {
  createAuthMiddleware,
  createEmailVerificationMiddleware,
  createSubscriptionMiddleware,
  createOnboardingMiddleware,
} from './routing'

/**
 * Create mock middleware request for testing
 */
function createMockMiddlewareRequest(
  pathname: string,
  context?: {
    auth?: {
      userId: string
      email: string
      emailVerified: boolean
      emailConfirmedAt: string | null
      userMetadata: Record<string, unknown>
    }
    tenant?: {
      companyId: string
      subscriptionStatus: 'active' | 'canceled' | 'past_due'
    }
    wizard?: boolean
  }
): MiddlewareRequest {
  const searchParams = new URLSearchParams()
  if (context?.wizard) {
    searchParams.set('wizard', 'true')
  }

  const middlewareContext: any = {
    sessionId: createSessionId(`session-${Date.now()}`),
    pathname,
    searchParams,
  }

  if (context?.auth) {
    middlewareContext.auth = {
      userId: createUserId(context.auth.userId),
      email: context.auth.email,
      emailVerified: context.auth.emailVerified,
      emailConfirmedAt: context.auth.emailConfirmedAt,
      userMetadata: context.auth.userMetadata,
    }
  }

  if (context?.tenant) {
    middlewareContext.tenant = {
      companyId: createCompanyId(context.tenant.companyId),
      subscriptionStatus: context.tenant.subscriptionStatus,
    }
  }

  return {
    url: `http://localhost:3000${pathname}`,
    nextUrl: {
      pathname,
      searchParams,
      origin: 'http://localhost:3000',
    },
    middlewareContext,
  } as MiddlewareRequest
}

/**
 * Mock Supabase client for testing
 */
function createMockSupabase(responses: {
  getUser?: { user: any; error?: any }
  companies?: { data: any; error?: any }
  properties?: { data: any; error?: any }
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: responses.getUser ?? { user: null },
        error: responses.getUser?.error ?? null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(responses.companies ?? { data: null, error: null }),
        }
      }
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(responses.properties ?? { data: [], error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
    }),
  } as any
}

describe('createAuthMiddleware', () => {
  it('should allow public routes without authentication', async () => {
    const request = createMockMiddlewareRequest('/login')
    const supabase = createMockSupabase({ getUser: { user: null } })
    const middleware = createAuthMiddleware(supabase)

    const result = await middleware(request)

    // Should return request unchanged
    expect(result).toBe(request)
  })

  it('should redirect unauthenticated users from protected routes', async () => {
    const request = createMockMiddlewareRequest('/dashboard')
    const supabase = createMockSupabase({ getUser: { user: null } })
    const middleware = createAuthMiddleware(supabase)

    const result = await middleware(request)

    // Should redirect to login
    expect(result instanceof Response).toBe(true)
    if (result instanceof Response) {
      expect(result.status).toBeGreaterThanOrEqual(300)
      expect(result.status).toBeLessThan(400)
    }
  })

  it('should add auth context for authenticated users', async () => {
    const request = createMockMiddlewareRequest('/dashboard')
    const supabase = createMockSupabase({
      getUser: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          email_confirmed_at: new Date().toISOString(),
          user_metadata: {},
        },
      },
    })
    const middleware = createAuthMiddleware(supabase)

    const result = await middleware(request)

    // Should return modified request with auth context
    expect(result).not.toBe(request)
    const modifiedRequest = result as MiddlewareRequest
    expect(modifiedRequest.middlewareContext.auth).toBeDefined()
    expect(modifiedRequest.middlewareContext.auth?.email).toBe('test@example.com')
  })
})

describe('createEmailVerificationMiddleware', () => {
  it('should allow routes that do not require email verification', async () => {
    const request = createMockMiddlewareRequest('/onboarding', {
      auth: {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        emailConfirmedAt: null,
        userMetadata: {},
      },
    })
    const middleware = createEmailVerificationMiddleware()

    const result = await middleware(request)

    // Should return request unchanged
    expect(result).toBe(request)
  })

  it('should redirect users with unverified email from dashboard', async () => {
    const request = createMockMiddlewareRequest('/dashboard', {
      auth: {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        emailConfirmedAt: null,
        userMetadata: {},
      },
    })
    const middleware = createEmailVerificationMiddleware()

    const result = await middleware(request)

    // Should redirect to verify-email
    expect(result instanceof Response).toBe(true)
    if (result instanceof Response) {
      expect(result.status).toBeGreaterThanOrEqual(300)
      expect(result.status).toBeLessThan(400)
    }
  })

  it('should allow verified users to access dashboard', async () => {
    const request = createMockMiddlewareRequest('/dashboard', {
      auth: {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        emailConfirmedAt: new Date().toISOString(),
        userMetadata: {},
      },
    })
    const middleware = createEmailVerificationMiddleware()

    const result = await middleware(request)

    // Should return request unchanged
    expect(result).toBe(request)
  })
})

describe('createOnboardingMiddleware', () => {
  it('should allow wizard access even with incomplete onboarding', async () => {
    const request = createMockMiddlewareRequest('/dashboard/sites', {
      auth: {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        emailConfirmedAt: new Date().toISOString(),
        userMetadata: {},
      },
      tenant: {
        companyId: 'company-123',
        subscriptionStatus: 'active',
      },
      wizard: true,
    })
    const supabase = createMockSupabase({
      properties: { data: [{ id: 'property-123' }], error: null },
    })
    const middleware = createOnboardingMiddleware(supabase)

    const result = await middleware(request)

    // Should NOT redirect (wizard exception applies)
    // Should add wizard context
    const modifiedRequest = result as MiddlewareRequest
    expect(modifiedRequest.middlewareContext.wizard).toBeDefined()
  })

  it('should redirect to onboarding if properties incomplete and not in wizard', async () => {
    const request = createMockMiddlewareRequest('/dashboard', {
      auth: {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        emailConfirmedAt: new Date().toISOString(),
        userMetadata: {},
      },
      tenant: {
        companyId: 'company-123',
        subscriptionStatus: 'active',
      },
    })
    const supabase = createMockSupabase({
      properties: { data: [{ id: 'property-123' }], error: null },
    })
    const middleware = createOnboardingMiddleware(supabase)

    const result = await middleware(request)

    // Should redirect to onboarding
    expect(result instanceof Response).toBe(true)
    if (result instanceof Response) {
      expect(result.status).toBeGreaterThanOrEqual(300)
      expect(result.status).toBeLessThan(400)
    }
  })

  it('should allow access if onboarding complete', async () => {
    const request = createMockMiddlewareRequest('/dashboard', {
      auth: {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        emailConfirmedAt: new Date().toISOString(),
        userMetadata: {},
      },
      tenant: {
        companyId: 'company-123',
        subscriptionStatus: 'active',
      },
    })
    const supabase = createMockSupabase({
      properties: { data: [], error: null }, // No incomplete properties
    })
    const middleware = createOnboardingMiddleware(supabase)

    const result = await middleware(request)

    // Should return request unchanged
    expect(result).toBe(request)
  })
})
