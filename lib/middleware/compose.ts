/**
 * Middleware Composition Pattern
 *
 * CAM-139: Implement Middleware Composition Pattern
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * CRITICAL: This composition pattern prevents the infinite redirect loops
 * that occurred during the live investor demo on Oct 30, 2025.
 *
 * Design Principles:
 * 1. Explicit execution order - middleware runs in the exact order provided
 * 2. Short-circuit mechanism - early returns (redirects/errors) stop the chain
 * 3. Context propagation - each middleware receives the accumulated context
 * 4. Type safety - TypeScript validates the entire middleware chain
 * 5. Async support - proper Promise handling throughout
 *
 * Inspired by:
 * - Express.js middleware pattern
 * - Redux middleware composition
 * - Functional composition patterns
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 * - C-7: Self-explanatory code with minimal comments
 */

import type { NextResponse } from 'next/server'
import type { MiddlewareRequest, MiddlewareFunction } from './types'

/**
 * Compose multiple middleware functions into a single middleware function
 *
 * Execution flow:
 * 1. Middleware execute in the order they are provided (left to right)
 * 2. Each middleware receives the request with accumulated context
 * 3. If a middleware returns NextResponse, execution stops (short-circuit)
 * 4. If a middleware returns a modified request, it's passed to the next middleware
 * 5. The final result is either a NextResponse or the last modified request
 *
 * Short-circuit behavior (stops execution):
 * - Redirect response (NextResponse.redirect)
 * - Error response (NextResponse.json with error status)
 * - Any NextResponse object
 *
 * Continue behavior (passes to next middleware):
 * - Modified MiddlewareRequest (with updated context)
 * - Original request unchanged
 *
 * Type Safety:
 * - Input: Array of MiddlewareFunction
 * - Output: Single MiddlewareFunction
 * - TypeScript validates the entire chain at compile time
 *
 * @param middlewares - Variable number of middleware functions to compose
 * @returns Single composed middleware function
 *
 * @example
 * ```typescript
 * import { composeMiddleware } from './compose'
 * import { authMiddleware } from './auth'
 * import { tenantMiddleware } from './tenant'
 * import { onboardingMiddleware } from './onboarding'
 *
 * // Compose middleware with explicit execution order
 * const middleware = composeMiddleware(
 *   authMiddleware,      // 1. Verify authentication
 *   tenantMiddleware,    // 2. Verify tenant/subscription
 *   onboardingMiddleware // 3. Check onboarding status
 * )
 *
 * // Use in Next.js middleware
 * export async function middleware(request: NextRequest) {
 *   const req = initializeRequest(request)
 *   return await middleware(req)
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Short-circuit example: auth middleware redirects unauthenticated users
 * const composed = composeMiddleware(
 *   authMiddleware,      // Returns redirect → stops execution
 *   tenantMiddleware,    // Never executes
 *   dashboardMiddleware  // Never executes
 * )
 * ```
 */
export function composeMiddleware(
  ...middlewares: MiddlewareFunction[]
): MiddlewareFunction {
  // Handle edge case: no middleware provided
  if (middlewares.length === 0) {
    return async (req: MiddlewareRequest) => req
  }

  // Handle edge case: single middleware (no composition needed)
  if (middlewares.length === 1) {
    return middlewares[0]!
  }

  // Compose multiple middleware functions
  return async (
    request: MiddlewareRequest
  ): Promise<NextResponse | MiddlewareRequest> => {
    // Accumulator for the current request state
    let currentRequest: MiddlewareRequest = request

    // Execute each middleware in order
    for (const middleware of middlewares) {
      // Execute the middleware with the current request
      const result = await middleware(currentRequest)

      // Check if result is a NextResponse (short-circuit)
      if (isNextResponse(result)) {
        // Middleware returned a response (redirect, error, etc.)
        // Stop execution and return the response
        return result
      }

      // Middleware returned a modified request
      // Pass it to the next middleware in the chain
      currentRequest = result
    }

    // All middleware executed successfully
    // Return the final modified request
    return currentRequest
  }
}

/**
 * Type guard to check if a value is a NextResponse
 *
 * CRITICAL: This determines whether to short-circuit middleware execution
 * or continue to the next middleware in the chain.
 *
 * A NextResponse indicates:
 * - Redirect (NextResponse.redirect)
 * - Error response (NextResponse.json)
 * - Early termination of middleware chain
 *
 * A MiddlewareRequest indicates:
 * - Continue to next middleware
 * - Pass accumulated context forward
 *
 * @param value - Value to check (NextResponse or MiddlewareRequest)
 * @returns True if value is a NextResponse, false if MiddlewareRequest
 */
function isNextResponse(
  value: NextResponse | MiddlewareRequest
): value is NextResponse {
  // NextResponse instances have specific properties and methods
  // Check for the presence of Response-like characteristics
  return (
    value instanceof Response ||
    (typeof value === 'object' &&
      value !== null &&
      'headers' in value &&
      'status' in value &&
      typeof (value as any).headers?.get === 'function')
  )
}

/**
 * Utility: Create a conditional middleware that only runs for specific routes
 *
 * This allows route-specific middleware to be composed with global middleware.
 * Useful for protecting specific route patterns without affecting all routes.
 *
 * @param condition - Function to determine if middleware should run
 * @param middleware - Middleware to conditionally execute
 * @returns Conditional middleware function
 *
 * @example
 * ```typescript
 * import { composeMiddleware, conditionalMiddleware } from './compose'
 *
 * const protectedRoutes = conditionalMiddleware(
 *   (req) => req.middlewareContext.pathname.startsWith('/dashboard'),
 *   tenantMiddleware
 * )
 *
 * const middleware = composeMiddleware(
 *   authMiddleware,    // Runs for all routes
 *   protectedRoutes    // Only runs for /dashboard/* routes
 * )
 * ```
 */
export function conditionalMiddleware(
  condition: (req: MiddlewareRequest) => boolean,
  middleware: MiddlewareFunction
): MiddlewareFunction {
  return async (req: MiddlewareRequest) => {
    // Check if condition is met
    if (condition(req)) {
      // Execute middleware
      return await middleware(req)
    }

    // Condition not met, pass request through unchanged
    return req
  }
}

/**
 * Utility: Create a middleware that logs execution for debugging
 *
 * Useful during development to trace middleware execution order and context.
 * SHOULD NOT be used in production (performance impact).
 *
 * @param label - Label for the middleware in logs
 * @param middleware - Middleware to wrap with logging
 * @returns Middleware with logging
 *
 * @example
 * ```typescript
 * import { composeMiddleware, loggingMiddleware } from './compose'
 *
 * const middleware = composeMiddleware(
 *   loggingMiddleware('Auth', authMiddleware),
 *   loggingMiddleware('Tenant', tenantMiddleware),
 *   loggingMiddleware('Onboarding', onboardingMiddleware)
 * )
 * ```
 */
export function loggingMiddleware(
  label: string,
  middleware: MiddlewareFunction
): MiddlewareFunction {
  return async (req: MiddlewareRequest) => {
    const { pathname, sessionId } = req.middlewareContext

    console.log(`[${label}] START - ${pathname} (session: ${sessionId})`)

    const startTime = Date.now()
    const result = await middleware(req)
    const duration = Date.now() - startTime

    const resultType = isNextResponse(result) ? 'Response' : 'Request'
    console.log(
      `[${label}] END - ${pathname} (${duration}ms) → ${resultType}`
    )

    return result
  }
}
