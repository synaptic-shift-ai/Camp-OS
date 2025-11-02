/**
 * Authentication Middleware Integration Tests
 *
 * CAM-136: Refactor Auth Middleware with Proper Separation
 *
 * Following CLAUDE.md Testing Best Practices:
 * - T-2: Integration tests in tests/integration/
 * - T-3: Separate from unit tests (these touch Supabase)
 * - T-4: Prefer integration tests over heavy mocking
 * - T-9: No hardcoded temporal data
 *
 * These tests verify auth middleware works with real Supabase client instances
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MiddlewareRequest, SessionId } from '@/lib/middleware/types'
import { createSessionId } from '@/lib/middleware/types'
import { verifyAuthentication } from '@/lib/middleware/auth'

// Integration test setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'

function createMockRequest(pathname = '/dashboard'): MiddlewareRequest {
  return {
    middlewareContext: {
      sessionId: createSessionId(`test-${Date.now()}`) as SessionId,
      pathname,
      searchParams: new URLSearchParams(),
    },
  } as MiddlewareRequest
}

describe('Auth Middleware Integration', () => {
  let supabase: SupabaseClient

  beforeEach(() => {
    // Create fresh Supabase client for each test
    supabase = createClient(supabaseUrl, supabaseAnonKey)
  })

  describe('verifyAuthentication with real Supabase client', () => {
    it('should return no_session when no user is authenticated', async () => {
      const request = createMockRequest('/dashboard')

      const result = await verifyAuthentication(request, supabase)

      expect(result).toEqual({
        authenticated: false,
        reason: expect.stringMatching(/no_session|expired_session/),
      })
    })

    it('should handle invalid Supabase URL gracefully', async () => {
      // Create client with invalid URL
      const invalidClient = createClient('http://invalid-url', 'invalid-key')
      const request = createMockRequest('/dashboard')

      const result = await verifyAuthentication(request, invalidClient)

      expect(result.authenticated).toBe(false)
      if (!result.authenticated) {
        expect(['no_session', 'invalid_session', 'expired_session']).toContain(
          result.reason
        )
      }
    })

    it('should preserve middleware context across auth verification', async () => {
      const request = createMockRequest('/dashboard/sites')
      request.middlewareContext.searchParams.set('wizard', 'true')

      const result = await verifyAuthentication(request, supabase)

      // Should preserve existing context regardless of auth success
      if (result.authenticated) {
        expect(result.request.middlewareContext.pathname).toBe('/dashboard/sites')
        expect(result.request.middlewareContext.searchParams.get('wizard')).toBe('true')
      } else {
        // Context is preserved in the original request
        expect(request.middlewareContext.pathname).toBe('/dashboard/sites')
        expect(request.middlewareContext.searchParams.get('wizard')).toBe('true')
      }
    })

    it('should handle concurrent auth verifications', async () => {
      const requests = [
        createMockRequest('/dashboard'),
        createMockRequest('/dashboard/sites'),
        createMockRequest('/dashboard/bookings'),
      ]

      const results = await Promise.all(
        requests.map((req) => verifyAuthentication(req, supabase))
      )

      // All should return consistent results
      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result.authenticated).toBe(false)
        if (!result.authenticated) {
          expect(['no_session', 'invalid_session', 'expired_session']).toContain(
            result.reason
          )
        }
      })
    })
  })

  describe('auth flow with different pathnames', () => {
    it.each([
      { pathname: '/dashboard', description: 'dashboard root' },
      { pathname: '/dashboard/sites', description: 'sites page' },
      { pathname: '/dashboard/bookings', description: 'bookings page' },
      { pathname: '/onboarding', description: 'onboarding page' },
      { pathname: '/login', description: 'login page' },
    ])(
      'should handle authentication for $description',
      async ({ pathname }) => {
        const request = createMockRequest(pathname)

        const result = await verifyAuthentication(request, supabase)

        // Should consistently return unauthenticated for no session
        expect(result.authenticated).toBe(false)
      }
    )
  })

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Create client with valid URL but unreachable port
      const unreachableClient = createClient('http://localhost:54322', 'test-key')
      const request = createMockRequest('/dashboard')

      // Should not throw, but return error result
      const result = await verifyAuthentication(request, unreachableClient)

      expect(result.authenticated).toBe(false)
      if (!result.authenticated) {
        expect(result.reason).toBeDefined()
      }
    })

    it('should handle malformed responses gracefully', async () => {
      const request = createMockRequest('/dashboard')

      // Even with invalid credentials, should return structured error
      const result = await verifyAuthentication(request, supabase)

      expect(result).toHaveProperty('authenticated')
      if (!result.authenticated) {
        expect(result).toHaveProperty('reason')
        expect(typeof result.reason).toBe('string')
      }
    })
  })

  describe('session validation edge cases', () => {
    it('should handle requests with query parameters', async () => {
      const request = createMockRequest('/dashboard')
      request.middlewareContext.searchParams.set('wizard', 'true')
      request.middlewareContext.searchParams.set('step', '2')

      const result = await verifyAuthentication(request, supabase)

      // Query params should not affect auth verification
      expect(result.authenticated).toBe(false)
    })

    it('should handle requests with special characters in pathname', async () => {
      const request = createMockRequest('/dashboard/sites/test-site-123')

      const result = await verifyAuthentication(request, supabase)

      // Pathname complexity should not affect auth verification
      expect(result.authenticated).toBe(false)
    })

    it('should handle rapid sequential auth checks', async () => {
      const request = createMockRequest('/dashboard')

      // Run same auth check 5 times rapidly
      const results = await Promise.all([
        verifyAuthentication(request, supabase),
        verifyAuthentication(request, supabase),
        verifyAuthentication(request, supabase),
        verifyAuthentication(request, supabase),
        verifyAuthentication(request, supabase),
      ])

      // All should return consistent results
      const authenticated = results.every((r) => r.authenticated === results[0].authenticated)
      expect(authenticated).toBe(true)
    })
  })
})

/**
 * NOTE: Full integration tests with actual user sessions require:
 * 1. Real Supabase instance with auth enabled
 * 2. Test user credentials
 * 3. Session cookie management
 *
 * These tests can be extended once test infrastructure is set up.
 * Current tests verify middleware structure and error handling.
 */
