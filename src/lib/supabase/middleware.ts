/**
 * Main Middleware Entry Point
 *
 * CAM-140: Update Main Middleware with Composition
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * ARCHITECTURE: Composition-based middleware system
 *
 * This middleware uses the composition pattern to execute multiple
 * middleware functions in a strict order with proper short-circuiting.
 *
 * Execution Order:
 * 1. Initialize request context (session ID, pathname, etc.)
 * 2. Auth middleware - Verify authentication
 * 3. Email verification middleware - Security gate for dashboard
 * 4. Subscription middleware - Verify active subscription and resolve tenant
 * 5. Onboarding middleware - Check property setup completion
 *
 * Short-circuit behavior:
 * - If any middleware returns NextResponse (redirect/error), execution stops
 * - If all middleware pass, the modified request continues to the route handler
 *
 * CRITICAL: This composition pattern prevents the infinite redirect loops
 * that occurred during the Oct 30, 2025 investor demo by properly handling
 * wizard exceptions.
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 * - BP-4: Multi-tenant isolation
 */

import type { NextRequest } from 'next/server'
import { type NextResponse } from 'next/server'
import { initializeRequest, createSupabaseClient, createInitialResponse } from '@/lib/middleware/init'
import { composeMiddleware } from '@/lib/middleware/compose'
import {
  createAuthMiddleware,
  createEmailVerificationMiddleware,
  createSubscriptionMiddleware,
  createOnboardingMiddleware,
} from '@/lib/middleware/routing'
import { RedirectLoopDetector } from '@/lib/middleware/loop-detector'
import { withErrorHandler } from '@/lib/middleware/error-handler'

/**
 * Update session and apply route protection middleware (internal implementation)
 *
 * This is the core middleware logic wrapped by error handler.
 * It orchestrates the entire middleware chain using composition.
 *
 * @param request - Next.js request object
 * @returns NextResponse with updated session cookies and redirect if needed
 */
async function updateSessionInternal(
  request: NextRequest
): Promise<NextResponse> {
  // Step 1: Create initial response for Supabase cookie management
  const supabaseResponse = createInitialResponse(request)

  // Step 2: Create Supabase client with cookie management
  const supabase = createSupabaseClient(request, supabaseResponse)

  // Step 3: Initialize middleware request with context
  const middlewareRequest = initializeRequest(request)

  // Step 4: Compose middleware functions in execution order
  const middleware = composeMiddleware(
    // 1. Auth: Verify authentication and add auth context
    createAuthMiddleware(supabase),

    // 2. Email Verification: Security gate for dashboard access
    createEmailVerificationMiddleware(),

    // 3. Subscription: Verify subscription and resolve tenant context
    createSubscriptionMiddleware(supabase),

    // 4. Onboarding: Check property setup completion (respects wizard exceptions)
    createOnboardingMiddleware(supabase)
  )

  // Step 5: Execute the middleware chain
  const result = await middleware(middlewareRequest)

  // Step 6: Handle the result
  // If result is NextResponse, middleware returned redirect/error - use it
  // If result is MiddlewareRequest, all middleware passed - use Supabase response
  if (
    result instanceof Response ||
    (typeof result === 'object' &&
      result !== null &&
      'headers' in result &&
      'status' in result)
  ) {
    // Type guard ensures this is NextResponse
    return result as NextResponse
  }

  // All middleware passed - reset redirect counter and return Supabase response
  RedirectLoopDetector.resetCount(supabaseResponse)
  return supabaseResponse
}

/**
 * Update session and apply route protection middleware
 *
 * This is the main entry point called by Next.js middleware.
 * Wrapped with global error handler to prevent crashes.
 *
 * @param request - Next.js request object
 * @returns NextResponse with updated session cookies and redirect if needed
 */
export const updateSession = withErrorHandler(updateSessionInternal)
