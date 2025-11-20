/**
 * Wizard Access Middleware
 *
 * CAM-138: Extract Wizard Access Logic to Dedicated Middleware
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * SINGLE RESPONSIBILITY: Detect and mark wizard access exceptions
 *
 * What this middleware does:
 * - Detects wizard access via ?wizard=true query parameter
 * - Detects onboarding route access
 * - Adds WizardContext to request.middlewareContext
 * - Prevents infinite redirect loops by marking wizard exceptions
 *
 * What this middleware DOES NOT do:
 * - Redirect logic (delegated to route handlers)
 * - Onboarding completion checks (delegated to onboarding middleware)
 * - Route protection (delegated to route middleware)
 *
 * CRITICAL: The Wizard Exception
 * After payment, users are redirected to /dashboard/sites?wizard=true
 * Without wizard exception logic, middleware sees incomplete onboarding → redirects to /onboarding
 * /onboarding page redirects to /dashboard/sites?wizard=true
 * Result: INFINITE REDIRECT LOOP (307 redirects)
 *
 * The wizard IS the onboarding process. It MUST be accessible even when
 * onboarding_completed = false. This middleware marks these access patterns
 * so downstream middleware (onboarding checks) knows to allow access.
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 * - C-7: Self-explanatory code with minimal comments
 * - BP-4: Clear separation of concerns
 */

import type {
  MiddlewareRequest,
  WizardContext,
} from './types'

/**
 * Wizard detection result
 * Separation of detection from handling allows route middleware to decide how to respond
 */
export type WizardResult =
  | { isWizard: true; context: WizardContext }
  | { isWizard: false }

/**
 * Detect wizard access patterns
 *
 * PURE FUNCTION: No side effects, no database queries
 * Takes request, returns wizard detection result
 *
 * Wizard access patterns:
 * 1. Query parameter: ?wizard=true
 * 2. Onboarding route: /onboarding/*
 *
 * These patterns indicate the user is actively IN the onboarding process,
 * and should not be redirected away even if onboarding is incomplete.
 *
 * @param request - Middleware request with context
 * @returns Wizard detection result
 */
export function detectWizardAccess(
  request: MiddlewareRequest
): WizardResult {
  const { pathname, searchParams } = request.middlewareContext

  // Pattern 1: Check for wizard query parameter
  const wizardParam = searchParams.get('wizard')
  const hasWizardParam = wizardParam === 'true'

  // Pattern 2: Check for onboarding route
  const isOnboardingRoute = pathname.startsWith('/onboarding')

  // If either pattern matches, user is in wizard mode
  if (hasWizardParam || isOnboardingRoute) {
    const wizardContext: WizardContext = {
      inWizard: true,
      wizardQueryParam: wizardParam ?? '',
    } as WizardContext

    return {
      isWizard: true,
      context: wizardContext,
    }
  }

  // No wizard access detected
  return {
    isWizard: false,
  }
}

/**
 * Check if a request is in wizard mode
 *
 * PURE FUNCTION: No side effects
 * Type guard for WizardRequest
 *
 * @param request - Middleware request
 * @returns True if request has wizard context
 */
export function isInWizardMode(request: MiddlewareRequest): boolean {
  return request.middlewareContext.wizard?.inWizard === true
}

/**
 * Check if wizard exception should apply for a given path
 *
 * PURE FUNCTION: No side effects
 * Determines if onboarding checks should be bypassed
 *
 * The wizard exception applies when:
 * - User is accessing dashboard with ?wizard=true
 * - User is on /onboarding route
 *
 * When wizard exception applies, onboarding middleware MUST NOT redirect.
 * The user is actively completing onboarding and needs access to the wizard.
 *
 * @param pathname - Request pathname
 * @param searchParams - Request search parameters
 * @returns True if wizard exception should apply
 */
export function shouldApplyWizardException(
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  // Check for wizard query parameter
  const hasWizardParam = searchParams.get('wizard') === 'true'

  // Check for onboarding route
  const isOnboardingRoute = pathname.startsWith('/onboarding')

  // Exception applies if either pattern matches
  return hasWizardParam || isOnboardingRoute
}

/**
 * Get safe paths for wizard access
 *
 * PURE FUNCTION: No side effects
 * Returns list of paths that are safe for wizard access
 *
 * @returns Array of safe paths for wizard mode
 */
export function getWizardSafePaths(): string[] {
  return [
    '/dashboard/sites',
    '/dashboard/locations',
    '/dashboard/amenities',
    '/dashboard/rates',
    '/onboarding',
  ]
}

/**
 * Validate wizard query parameter
 *
 * PURE FUNCTION: No side effects
 * Ensures wizard parameter is properly formatted
 *
 * @param wizardParam - Wizard query parameter value
 * @returns True if parameter is valid
 */
export function isValidWizardParam(wizardParam: string | null): boolean {
  // Only 'true' is valid, case-sensitive
  return wizardParam === 'true'
}
