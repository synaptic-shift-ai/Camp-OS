/**
 * Authentication Middleware Unit Tests
 *
 * CAM-136: Refactor Auth Middleware with Proper Separation
 *
 * Following CLAUDE.md Testing Best Practices:
 * - T-1: Colocate unit tests with source file
 * - T-3: Pure logic unit tests (no database)
 * - T-6: Test entire structure in one assertion
 * - T-9: No hardcoded temporal data
 */

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { MiddlewareRequest, SessionId } from './types'
import { createSessionId } from './types'
import {
  verifyAuthentication,
  requiresEmailVerification,
  isSessionFresh,
  type AuthResult,
} from './auth'

// Test data factory
function createMockRequest(pathname = '/dashboard'): MiddlewareRequest {
  return {
    middlewareContext: {
      sessionId: createSessionId('test-session-123') as SessionId,
      pathname,
      searchParams: new URLSearchParams(),
    },
  } as MiddlewareRequest
}

function createMockUser(overrides?: Partial<User>): User {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { user_type: 'buyer' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User
}

function createMockSupabase(
  user: User | null,
  error: Error | null = null
): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error,
      }),
    },
  } as unknown as SupabaseClient
}

describe('verifyAuthentication', () => {
  describe('successful authentication', () => {
    it('should authenticate valid user and add auth context to request', async () => {
      const mockUser = createMockUser()
      const supabase = createMockSupabase(mockUser)
      const request = createMockRequest()

      const result = await verifyAuthentication(request, supabase)

      expect(result).toEqual({
        authenticated: true,
        request: expect.objectContaining({
          middlewareContext: expect.objectContaining({
            sessionId: expect.any(String),
            pathname: '/dashboard',
            auth: {
              userId: mockUser.id,
              email: mockUser.email,
              emailVerified: true,
              emailConfirmedAt: mockUser.email_confirmed_at,
              userMetadata: mockUser.user_metadata,
            },
          }),
        }),
      })
    })

    it('should handle user with unverified email', async () => {
      const baseUser = createMockUser()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockUser = { ...baseUser, email_confirmed_at: null, app_metadata: {} } as any
      const supabase = createMockSupabase(mockUser)
      const request = createMockRequest()

      const result = await verifyAuthentication(request, supabase) as Extract<
        AuthResult,
        { authenticated: true }
      >

      expect(result.authenticated).toBe(true)
      expect(result.request.middlewareContext.auth?.emailVerified).toBe(false)
      expect(result.request.middlewareContext.auth?.emailConfirmedAt).toBeNull()
    })

    it('should treat custom_email_verified as verified when email_confirmed_at is null', async () => {
      const baseUser = createMockUser()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockUser = { ...baseUser, email_confirmed_at: null, app_metadata: { custom_email_verified: true } } as any
      const supabase = createMockSupabase(mockUser)
      const request = createMockRequest()

      const result = await verifyAuthentication(request, supabase) as Extract<
        AuthResult,
        { authenticated: true }
      >

      expect(result.authenticated).toBe(true)
      expect(result.request.middlewareContext.auth?.emailVerified).toBe(true)
    })

    it('should handle user with empty metadata', async () => {
      const mockUser = createMockUser({ user_metadata: {} })
      const supabase = createMockSupabase(mockUser)
      const request = createMockRequest()

      const result = await verifyAuthentication(request, supabase) as Extract<
        AuthResult,
        { authenticated: true }
      >

      expect(result.authenticated).toBe(true)
      expect(result.request.middlewareContext.auth?.userMetadata).toEqual({})
    })
  })

  describe('failed authentication', () => {
    it('should return no_session when user is null', async () => {
      const supabase = createMockSupabase(null)
      const request = createMockRequest()

      const result = await verifyAuthentication(request, supabase)

      expect(result).toEqual({
        authenticated: false,
        reason: 'no_session',
      })
    })

    it('should return expired_session when error contains expired', async () => {
      const error = new Error('Session expired')
      const supabase = createMockSupabase(null, error)
      const request = createMockRequest()

      const result = await verifyAuthentication(request, supabase)

      expect(result).toEqual({
        authenticated: false,
        reason: 'expired_session',
      })
    })

    it('should return invalid_session when Supabase returns error with user', async () => {
      const mockUser = createMockUser()
      const error = new Error('Invalid session')
      const supabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error,
          }),
        },
      } as unknown as SupabaseClient

      const request = createMockRequest()

      const result = await verifyAuthentication(request, supabase)

      expect(result).toEqual({
        authenticated: false,
        reason: 'invalid_session',
      })
    })
  })

  describe('edge cases', () => {
    it('should preserve existing middleware context', async () => {
      const mockUser = createMockUser()
      const supabase = createMockSupabase(mockUser)
      const request = {
        middlewareContext: {
          sessionId: createSessionId('existing-session'),
          pathname: '/dashboard/sites',
          searchParams: new URLSearchParams('wizard=true'),
        },
      } as MiddlewareRequest

      const result = await verifyAuthentication(request, supabase) as Extract<
        AuthResult,
        { authenticated: true }
      >

      expect(result.authenticated).toBe(true)
      expect(result.request.middlewareContext.sessionId).toBe('existing-session')
      expect(result.request.middlewareContext.pathname).toBe('/dashboard/sites')
      expect(result.request.middlewareContext.searchParams.get('wizard')).toBe('true')
    })

    it('should handle user with unusual email format', async () => {
      const mockUser = createMockUser({ email: 'test+tag@example.com' })
      const supabase = createMockSupabase(mockUser)
      const request = createMockRequest()

      const result = await verifyAuthentication(request, supabase) as Extract<
        AuthResult,
        { authenticated: true }
      >

      expect(result.authenticated).toBe(true)
      // Email with + tag should be preserved
      expect(result.request.middlewareContext.auth?.email).toBe('test+tag@example.com')
    })
  })
})

describe('requiresEmailVerification', () => {
  it.each([
    { pathname: '/dashboard', expected: true },
    { pathname: '/dashboard/sites', expected: true },
    { pathname: '/company-details', expected: true },
    { pathname: '/choose-plan', expected: true },
    { pathname: '/onboarding', expected: true },
    { pathname: '/payment', expected: true },
    { pathname: '/login', expected: false },
    { pathname: '/', expected: false },
  ])('should return $expected for pathname $pathname', ({ pathname, expected }) => {
    expect(requiresEmailVerification(pathname)).toBe(expected)
  })
})

describe('isSessionFresh', () => {
  describe('with valid timestamps', () => {
    it('should return true for session confirmed 30 minutes ago', () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      expect(isSessionFresh(thirtyMinutesAgo, 60)).toBe(true)
    })

    it('should return false for session confirmed 90 minutes ago', () => {
      const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString()
      expect(isSessionFresh(ninetyMinutesAgo, 60)).toBe(false)
    })

    it('should return true for session confirmed exactly at max age', () => {
      const exactlyOneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      expect(isSessionFresh(exactlyOneHourAgo, 60)).toBe(true)
    })

    it('should use custom max age', () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      expect(isSessionFresh(fifteenMinutesAgo, 10)).toBe(false)
      expect(isSessionFresh(fifteenMinutesAgo, 20)).toBe(true)
    })

    it('should return true for very recent confirmation', () => {
      const justNow = new Date(Date.now() - 1000).toISOString()
      expect(isSessionFresh(justNow, 60)).toBe(true)
    })
  })

  describe('with invalid inputs', () => {
    it('should return false for null timestamp', () => {
      expect(isSessionFresh(null, 60)).toBe(false)
    })

    it('should handle future timestamp gracefully', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      // Future dates have negative age, which will be <= maxAge (60)
      // This is an edge case that shouldn't happen in practice
      // We accept it as fresh since it's technically "recent"
      expect(isSessionFresh(futureDate, 60)).toBe(true)
    })
  })
})
