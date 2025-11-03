/**
 * Middleware Initialization Utilities
 *
 * CAM-140: Update Main Middleware with Composition
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * SINGLE RESPONSIBILITY: Initialize middleware request and Supabase client
 *
 * What this module does:
 * - Converts NextRequest to MiddlewareRequest with context
 * - Creates Supabase client configured for middleware
 * - Generates unique session IDs for request tracking
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 * - C-7: Self-explanatory code with minimal comments
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MiddlewareRequest, SessionId } from './types'
import { createSessionId } from './types'
import { getRequiredEnv } from './error-handler'

/**
 * Initialize a middleware request from a Next.js request
 *
 * PURE FUNCTION: Minimal side effects (session ID generation only)
 * Converts NextRequest to MiddlewareRequest with initialized context
 *
 * @param request - Next.js request object
 * @returns Middleware request with initialized context
 */
export function initializeRequest(request: NextRequest): MiddlewareRequest {
  // Generate unique session ID for this request
  const sessionId: SessionId = createSessionId(
    `${Date.now()}-${Math.random().toString(36).substring(7)}`
  )

  // Extract URL components from request
  // CRITICAL: request.nextUrl can be undefined in some browsers (Edge) after
  // Supabase magic link redirects. Provide safe fallbacks.
  const nextUrl = request.nextUrl || new URL(request.url)
  const pathname = nextUrl.pathname
  const searchParams = nextUrl.searchParams
  const origin = nextUrl.origin

  // CRITICAL: DO NOT spread the request object!
  // Spreading loses getter properties (cookies, headers, nextUrl) which breaks
  // both Chrome and Edge. Instead, attach middlewareContext directly to the
  // original request object.
  // This cast is safe because TypeScript intersection types allow adding properties.
  const middlewareRequest = request as MiddlewareRequest
  middlewareRequest.middlewareContext = {
    sessionId,
    pathname,
    searchParams,
    origin,
  }

  return middlewareRequest
}

/**
 * Create Supabase client for middleware
 *
 * CRITICAL: This client handles cookie management for SSR
 * - Reads cookies from request
 * - Updates cookies in response
 * - Maintains session state across middleware chain
 *
 * @param request - Next.js request object
 * @param response - Next.js response object (mutable)
 * @returns Supabase client configured for middleware
 */
export function createSupabaseClient(
  request: NextRequest,
  response: NextResponse
): SupabaseClient {
  // Use safe env getter that throws descriptive errors
  const supabaseUrl = getRequiredEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'Supabase URL'
  )
  const supabaseAnonKey = getRequiredEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'Supabase Anonymous Key'
  )

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // Read all cookies from request
      getAll() {
        return request.cookies.getAll()
      },
      // Set cookies in both request and response
      setAll(
        cookiesToSet: {
          name: string
          value: string
          options?: CookieOptions
        }[]
      ) {
        // Update request cookies for downstream middleware
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        // Update response cookies for client
        cookiesToSet.forEach(({ name, value, options }) => {
          if (options) {
            response.cookies.set(name, value, options)
          } else {
            response.cookies.set(name, value)
          }
        })
      },
    },
  })

  return supabase
}

/**
 * Create initial NextResponse for middleware chain
 *
 * This response will be mutated by Supabase client cookie operations
 * and returned at the end of the middleware chain if no redirects occur.
 *
 * @param request - Next.js request object
 * @returns NextResponse configured to continue request
 */
export function createInitialResponse(request: NextRequest): NextResponse {
  return NextResponse.next({
    request,
  })
}
