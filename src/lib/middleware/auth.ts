/**
 * Authentication Middleware
 *
 * CAM-136: Refactor Auth Middleware with Proper Separation
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * SINGLE RESPONSIBILITY: Verify authentication and add auth context to request
 *
 * What this middleware does:
 * - Validates user session with Supabase
 * - Extracts authentication context (userId, email, verification status)
 * - Adds AuthContext to request.middlewareContext
 *
 * What this middleware DOES NOT do:
 * - Redirect logic (delegated to route handlers)
 * - Route protection (delegated to route middleware)
 * - Subscription checks (delegated to tenant middleware)
 * - Onboarding checks (delegated to onboarding middleware)
 *
 * Following CLAUDE.md:
 * - C-5: Use branded types for domain IDs
 * - C-6: Use import type for type-only imports
 * - BP-4: Proper multi-tenant isolation
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MiddlewareRequest,
  AuthenticatedRequest,
  AuthContext,
} from './types'
import { createUserId } from './types'

/**
 * Authentication result
 * Separation of verification from handling allows route middleware to decide how to respond
 */
export type AuthResult =
  | { authenticated: true; request: AuthenticatedRequest }
  | { authenticated: false; reason: AuthFailureReason }

/**
 * Reasons why authentication failed
 * Provides actionable context for route handlers
 */
export type AuthFailureReason =
  | 'no_session'
  | 'invalid_session'
  | 'expired_session'
  | 'email_unverified'

/**
 * Authentication verification function
 *
 * PURE FUNCTION: No side effects, no redirects
 * Takes request and Supabase client, returns authentication result
 *
 * @param request - Middleware request with context
 * @param supabase - Supabase client for auth verification
 * @returns Authentication result with success/failure reason
 */
export async function verifyAuthentication(
  request: MiddlewareRequest,
  supabase: SupabaseClient
): Promise<AuthResult> {
  // Verify session with Supabase
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // No user found - session doesn't exist
  if (!user) {
    return {
      authenticated: false,
      reason: error?.message.includes('expired') ? 'expired_session' : 'no_session',
    }
  }

  // Session invalid - Supabase returned error
  if (error) {
    return {
      authenticated: false,
      reason: 'invalid_session',
    }
  }

  // Create auth context with branded types
  const authContext: AuthContext = {
    userId: createUserId(user.id),
    email: user.email ?? '',
    emailVerified: !!user.email_confirmed_at,
    emailConfirmedAt: user.email_confirmed_at,
    userMetadata: user.user_metadata || {},
  } as AuthContext

  // Add auth context to request
  const authenticatedRequest: AuthenticatedRequest = {
    ...request,
    middlewareContext: {
      ...request.middlewareContext,
      auth: authContext,
    },
  } as AuthenticatedRequest

  return {
    authenticated: true,
    request: authenticatedRequest,
  }
}

/**
 * Check if email verification is required for a given path
 *
 * PURE FUNCTION: No side effects
 * Route protection logic separated from auth verification
 *
 * @param pathname - Request pathname
 * @returns True if email verification is required
 */
export function requiresEmailVerification(pathname: string): boolean {
  // Email verification required for dashboard access (security gate)
  return pathname.startsWith('/dashboard')
}

/**
 * Validate session freshness
 *
 * PURE FUNCTION: No side effects
 * Checks if session was recently confirmed
 *
 * @param emailConfirmedAt - Timestamp when email was confirmed
 * @param maxAgeMinutes - Maximum age in minutes (default: 60)
 * @returns True if session is fresh
 */
export function isSessionFresh(
  emailConfirmedAt: string | null,
  maxAgeMinutes = 60
): boolean {
  if (!emailConfirmedAt) return false

  const confirmedAt = new Date(emailConfirmedAt)
  const now = new Date()
  const ageMinutes = (now.getTime() - confirmedAt.getTime()) / (1000 * 60)

  return ageMinutes <= maxAgeMinutes
}
