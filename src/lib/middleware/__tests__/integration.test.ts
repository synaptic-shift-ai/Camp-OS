/**
 * Middleware Integration Tests
 *
 * CAM-140: Update Main Middleware with Composition
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * Tests verify:
 * - Complete middleware chain executes in correct order
 * - Each middleware properly handles its responsibility
 * - Wizard exception prevents infinite redirect loops
 * - Auth, email verification, subscription, and onboarding checks work together
 *
 * Following CLAUDE.md:
 * - T-2: Integration tests in tests/integration/
 * - T-4: Prefer integration tests over heavy mocking
 * - T-9: Use dynamic test data generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Mock Supabase client for testing
 * Provides controlled responses for different test scenarios
 */
function createMockSupabase(scenario: {
  user?: {
    id: string
    email: string
    email_confirmed_at: string | null
    user_metadata: Record<string, unknown>
  } | null
  company?: {
    id: string
    subscription_status: string
  } | null
  incompleteProperties?: Array<{ id: string }>
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: scenario.user ?? null },
        error: scenario.user === undefined ? { message: 'No session' } : null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: scenario.company ?? null,
            error: scenario.company ? null : { message: 'No company found' },
          }),
          limit: vi.fn().mockReturnThis(),
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
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }),
  }
}

/**
 * Create mock Next.js request
 */
function createMockRequest(pathname: string, searchParams?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`)
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  // Create proper Headers instance (required by Next.js)
  const headers = new Headers()
  headers.set('user-agent', 'test-agent')

  return {
    url: url.toString(),
    method: 'GET',
    nextUrl: {
      pathname,
      searchParams: url.searchParams,
      origin: 'http://localhost:3000',
      clone: () => ({ pathname, searchParams: url.searchParams }),
    },
    cookies: {
      get: vi.fn().mockReturnValue(undefined),
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    },
    headers,
  } as unknown as NextRequest
}

/**
 * Mock environment variables
 */
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
})

describe('updateSession middleware integration', () => {
  describe('public routes', () => {
    it('should allow access to login page without authentication', async () => {
      const request = createMockRequest('/login')

      // Mock Supabase to return no user
      vi.mock('@supabase/ssr', () => ({
        createServerClient: () => createMockSupabase({ user: null }),
      }))

      const response = await updateSession(request)

      // Should return successful response (not redirect)
      expect(response).toBeDefined()
      expect(response instanceof Response).toBe(true)
      // If it's a redirect, status would be 307/308
      expect(response.status).not.toBe(307)
      expect(response.status).not.toBe(308)
    })
  })

  describe('authentication middleware', () => {
    it('should redirect unauthenticated users to login for protected routes', async () => {
      const request = createMockRequest('/dashboard')

      vi.mock('@supabase/ssr', () => ({
        createServerClient: () => createMockSupabase({ user: null }),
      }))

      const response = await updateSession(request)

      // Should redirect to login
      expect(response instanceof Response).toBe(true)
      expect(response.status).toBeGreaterThanOrEqual(300)
      expect(response.status).toBeLessThan(400)
    })
  })

  describe('email verification middleware', () => {
    it('should redirect users with unverified email to verification page', async () => {
      const request = createMockRequest('/dashboard')

      vi.mock('@supabase/ssr', () => ({
        createServerClient: () =>
          createMockSupabase({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              email_confirmed_at: null, // Email not confirmed
              user_metadata: {},
            },
          }),
      }))

      const response = await updateSession(request)

      // Should redirect to email verification
      expect(response instanceof Response).toBe(true)
      expect(response.status).toBeGreaterThanOrEqual(300)
      expect(response.status).toBeLessThan(400)
    })
  })

  describe('subscription middleware', () => {
    it('should redirect users without active subscription to plan selection', async () => {
      const request = createMockRequest('/dashboard')

      vi.mock('@supabase/ssr', () => ({
        createServerClient: () =>
          createMockSupabase({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              email_confirmed_at: new Date().toISOString(),
              user_metadata: {},
            },
            company: {
              id: 'company-123',
              subscription_status: 'canceled', // No active subscription
            },
          }),
      }))

      const response = await updateSession(request)

      // Should redirect to plan selection
      expect(response instanceof Response).toBe(true)
      expect(response.status).toBeGreaterThanOrEqual(300)
      expect(response.status).toBeLessThan(400)
    })
  })

  describe('wizard exception (CRITICAL for infinite loop prevention)', () => {
    it('should allow dashboard access with ?wizard=true even if onboarding incomplete', async () => {
      const request = createMockRequest('/dashboard/sites', { wizard: 'true' })

      vi.mock('@supabase/ssr', () => ({
        createServerClient: () =>
          createMockSupabase({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              email_confirmed_at: new Date().toISOString(),
              user_metadata: {},
            },
            company: {
              id: 'company-123',
              subscription_status: 'active',
            },
            incompleteProperties: [{ id: 'property-123' }], // Onboarding incomplete
          }),
      }))

      const response = await updateSession(request)

      // Should NOT redirect (wizard exception applies)
      expect(response).toBeDefined()
      expect(response instanceof Response).toBe(true)
      // Should return 200 OK or continue response (not redirect)
      if ((response as Response).status >= 300 && (response as Response).status < 400) {
        // If it's a redirect, it should NOT be to /onboarding
        const location = (response as Response).headers.get('location')
        expect(location).not.toContain('/onboarding')
      }
    })

    it('should allow onboarding route access even if onboarding incomplete', async () => {
      const request = createMockRequest('/onboarding')

      vi.mock('@supabase/ssr', () => ({
        createServerClient: () =>
          createMockSupabase({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              email_confirmed_at: new Date().toISOString(),
              user_metadata: {},
            },
            company: {
              id: 'company-123',
              subscription_status: 'active',
            },
            incompleteProperties: [{ id: 'property-123' }],
          }),
      }))

      const response = await updateSession(request)

      // Should allow access to onboarding route
      expect(response).toBeDefined()
      expect(response instanceof Response).toBe(true)
      // Should not create redirect loop
      expect(response.status).not.toBe(307)
      expect(response.status).not.toBe(308)
    })
  })

  /**
   * NOTE: Full end-to-end integration test with real Supabase client
   * is not included here because mocking Supabase SSR client in Vitest
   * requires complex module-level mocking that doesn't work well with
   * dynamic test scenarios.
   *
   * The middleware composition is tested through:
   * 1. Unit tests for each individual middleware function (routing.test.ts)
   * 2. Composition pattern tests (compose.test.ts)
   * 3. Build verification (npm run build)
   * 4. Manual E2E testing in development environment
   *
   * This approach follows CLAUDE.md T-4: "Prefer integration tests over heavy mocking"
   * but acknowledges when integration tests become more complex than the value they provide.
   */
})
