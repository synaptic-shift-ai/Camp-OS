/**
 * Route Protection Middleware
 *
 * CAM-140: Update Main Middleware with Composition
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * SINGLE RESPONSIBILITY: Route-level protection and redirect logic
 *
 * What this module does:
 * - Implements route protection using auth/tenant/wizard verification
 * - Handles redirect logic based on verification failures
 * - Composes individual verification middlewares into complete flow
 *
 * What this module DOES NOT do:
 * - Auth verification (delegated to auth.ts)
 * - Tenant resolution (delegated to tenant.ts)
 * - Wizard detection (delegated to wizard.ts)
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 * - BP-4: Multi-tenant isolation
 */

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MiddlewareRequest, MiddlewareFunction } from './types'
import { verifyAuthentication, requiresEmailVerification } from './auth'
import { resolveTenant, requiresActiveSubscription } from './tenant'
import { detectWizardAccess, shouldApplyWizardException } from './wizard'
import { RedirectLoopDetector } from './loop-detector'
import { createLogger } from './logger'
import {
  recordRequest,
  recordDuration,
  recordRedirect,
  recordRedirectLoopPrevented,
  recordError,
  startTimer,
  METRICS,
} from './metrics'

/**
 * Authentication middleware function
 *
 * Verifies user authentication and redirects to login if unauthenticated.
 * Only applies to routes that require authentication.
 *
 * @param supabase - Supabase client for auth verification
 * @returns Middleware function
 */
export function createAuthMiddleware(
  supabase: SupabaseClient
): MiddlewareFunction {
  return async (request: MiddlewareRequest) => {
    const { pathname, sessionId } = request.middlewareContext
    const logger = createLogger(sessionId, 'auth-middleware')
    const timer = startTimer()

    // Record request
    recordRequest('auth-middleware', pathname)

    // Define routes that require authentication
    const requiresAuth = ['/dashboard', '/onboarding']
    const needsAuth = requiresAuth.some((route) => pathname.startsWith(route))

    // Skip auth check for public routes
    if (!needsAuth) {
      logger.debug('Skipping auth check for public route', { pathname })
      recordDuration('auth-middleware', timer.end(), 'success')
      return request
    }

    // Special case: Allow /onboarding with magic link token (from email)
    // Users clicking email links won't be authenticated yet
    if (pathname === '/onboarding' && request.nextUrl.searchParams.has('token')) {
      logger.debug('Allowing /onboarding with magic link token', { pathname })
      recordDuration('auth-middleware', timer.end(), 'success')
      return request
    }

    logger.info('Verifying authentication', { pathname })

    try {
      // Verify authentication
      const authResult = await verifyAuthentication(request, supabase)

      // Not authenticated - redirect to login
      if (!authResult.authenticated) {
        const url = new URL('/login', request.nextUrl.origin)
        url.searchParams.set('redirect', pathname)

        logger.info('Redirecting unauthenticated user to login', {
          from: pathname,
          to: url.pathname,
        })

        // CRITICAL: Check for redirect loops before redirecting
        if (!RedirectLoopDetector.check(request, url.pathname)) {
          // Loop detected - allow access to prevent stuck users
          logger.error(
            'Redirect loop detected in auth middleware',
            new Error('Auth redirect loop'),
            { pathname, targetPath: url.pathname }
          )
          recordRedirectLoopPrevented('auth-middleware', pathname)
          recordDuration('auth-middleware', timer.end(), 'failure')
          return request
        }

        recordRedirect('auth-middleware', url.pathname)
        recordDuration('auth-middleware', timer.end(), 'redirect')

        const response = NextResponse.redirect(url)
        RedirectLoopDetector.incrementCount(response)
        return response
      }

      logger.info('Authentication successful', {
        userId: authResult.request.middlewareContext.auth?.userId,
        emailVerified:
          authResult.request.middlewareContext.auth?.emailVerified,
      })

      recordDuration('auth-middleware', timer.end(), 'success')

      // Return authenticated request for next middleware
      return authResult.request
    } catch (error) {
      recordError('auth-middleware', 'authentication_error')
      recordDuration('auth-middleware', timer.end(), 'failure')
      throw error
    }
  }
}

/**
 * Email verification middleware function
 *
 * Verifies user's email is confirmed for dashboard access.
 * This is a security gate to prevent unverified users from accessing sensitive features.
 *
 * @returns Middleware function
 */
export function createEmailVerificationMiddleware(): MiddlewareFunction {
  return async (request: MiddlewareRequest) => {
    const { pathname, auth, sessionId } = request.middlewareContext
    const logger = createLogger(sessionId, 'email-verification-middleware')
    const timer = startTimer()

    // Record request
    recordRequest('email-verification-middleware', pathname)

    // Skip if auth context not present (previous middleware handles this)
    if (!auth) {
      logger.debug('Skipping email verification - no auth context', { pathname })
      recordDuration('email-verification-middleware', timer.end(), 'success')
      return request
    }

    // Check if this route requires email verification
    if (!requiresEmailVerification(pathname)) {
      logger.debug('Skipping email verification for route', { pathname })
      recordDuration('email-verification-middleware', timer.end(), 'success')
      return request
    }

    logger.info('Verifying email confirmation', {
      pathname,
      userId: auth.userId,
      emailVerified: auth.emailVerified,
    })

    // Email not verified - redirect to verification page
    if (!auth.emailVerified) {
      const url = new URL('/verify-email', request.nextUrl.origin)
      url.searchParams.set('redirect', pathname)

      logger.info('Redirecting user with unverified email', {
        from: pathname,
        to: url.pathname,
        userId: auth.userId,
      })

      // CRITICAL: Check for redirect loops before redirecting
      if (!RedirectLoopDetector.check(request, url.pathname)) {
        // Loop detected - allow access to prevent stuck users
        logger.error(
          'Redirect loop detected in email verification middleware',
          new Error('Email verification redirect loop'),
          { pathname, targetPath: url.pathname, userId: auth.userId }
        )
        recordRedirectLoopPrevented('email-verification-middleware', pathname)
        recordDuration('email-verification-middleware', timer.end(), 'failure')
        return request
      }

      recordRedirect('email-verification-middleware', url.pathname)
      recordDuration('email-verification-middleware', timer.end(), 'redirect')

      const response = NextResponse.redirect(url)
      RedirectLoopDetector.incrementCount(response)
      return response
    }

    logger.info('Email verified successfully', { userId: auth.userId })

    recordDuration('email-verification-middleware', timer.end(), 'success')

    // Email verified - continue
    return request
  }
}

/**
 * Subscription middleware function
 *
 * Verifies user has active subscription and resolves tenant context.
 * Redirects to plan selection if no active subscription.
 *
 * @param supabase - Supabase client for tenant resolution
 * @returns Middleware function
 */
export function createSubscriptionMiddleware(
  supabase: SupabaseClient
): MiddlewareFunction {
  return async (request: MiddlewareRequest) => {
    const { pathname, auth, sessionId } = request.middlewareContext
    const logger = createLogger(sessionId, 'subscription-middleware')
    const timer = startTimer()

    // Record request
    recordRequest('subscription-middleware', pathname)

    // Skip if auth context not present
    if (!auth) {
      logger.debug('Skipping subscription check - no auth context', { pathname })
      recordDuration('subscription-middleware', timer.end(), 'success')
      return request
    }

    // Check if this route requires subscription
    if (!requiresActiveSubscription(pathname)) {
      logger.debug('Skipping subscription check for route', { pathname })
      recordDuration('subscription-middleware', timer.end(), 'success')
      return request
    }

    // Don't redirect if already on payment/plan pages
    if (
      pathname.startsWith('/choose-plan') ||
      pathname.startsWith('/payment')
    ) {
      logger.debug('On payment/plan page, skipping redirect', { pathname })
      recordDuration('subscription-middleware', timer.end(), 'success')
      return request
    }

    logger.info('Resolving tenant and subscription', {
      pathname,
      userId: auth.userId,
    })

    // Resolve tenant context (includes subscription check)
    // We know auth is present from previous middleware checks
    // Type guard ensures the request has auth context
    if (!request.middlewareContext.auth) {
      // This should never happen due to middleware order, but TypeScript needs the check
      recordDuration('subscription-middleware', timer.end(), 'success')
      return request
    }

    try {
      const tenantResult = await resolveTenant(
        request as Parameters<typeof resolveTenant>[0],
        supabase
      )

      // No active subscription - redirect to plan selection
      if (!tenantResult.resolved) {
        const url = new URL('/choose-plan', request.nextUrl.origin)

        logger.info('Redirecting user without active subscription', {
          from: pathname,
          to: url.pathname,
          userId: auth.userId,
        })

        // CRITICAL: Check for redirect loops before redirecting
        if (!RedirectLoopDetector.check(request, url.pathname)) {
          // Loop detected - allow access to prevent stuck users
          logger.error(
            'Redirect loop detected in subscription middleware',
            new Error('Subscription redirect loop'),
            { pathname, targetPath: url.pathname, userId: auth.userId }
          )
          recordRedirectLoopPrevented('subscription-middleware', pathname)
          recordDuration('subscription-middleware', timer.end(), 'failure')
          return request
        }

        recordRedirect('subscription-middleware', url.pathname)
        recordDuration('subscription-middleware', timer.end(), 'redirect')

        const response = NextResponse.redirect(url)
        RedirectLoopDetector.incrementCount(response)
        return response
      }

      logger.info('Tenant and subscription resolved', {
        userId: auth.userId,
        companyId: tenantResult.request.middlewareContext.tenant?.companyId,
        subscriptionStatus:
          tenantResult.request.middlewareContext.tenant?.subscriptionStatus,
      })

      recordDuration('subscription-middleware', timer.end(), 'success')

      // Return tenant-resolved request for next middleware
      return tenantResult.request
    } catch (error) {
      recordError('subscription-middleware', 'tenant_resolution_error')
      recordDuration('subscription-middleware', timer.end(), 'failure')
      throw error
    }
  }
}

/**
 * Onboarding middleware function
 *
 * Checks if user has incomplete properties and redirects to onboarding if needed.
 * Respects wizard exceptions to prevent infinite redirect loops.
 *
 * CRITICAL: This middleware prevents the infinite redirect loop bug that occurred
 * during the Oct 30, 2025 investor demo.
 *
 * @param supabase - Supabase client for onboarding status check
 * @returns Middleware function
 */
export function createOnboardingMiddleware(
  supabase: SupabaseClient
): MiddlewareFunction {
  return async (request: MiddlewareRequest) => {
    const { pathname, searchParams, tenant, sessionId, auth } =
      request.middlewareContext
    const logger = createLogger(sessionId, 'onboarding-middleware')
    const timer = startTimer()

    // Record request
    recordRequest('onboarding-middleware', pathname)

    // Skip if tenant context not present
    if (!tenant) {
      logger.debug('Skipping onboarding check - no tenant context', { pathname })
      recordDuration('onboarding-middleware', timer.end(), 'success')
      return request
    }

    // Only check onboarding for dashboard routes
    if (!pathname.startsWith('/dashboard')) {
      logger.debug('Skipping onboarding check for non-dashboard route', {
        pathname,
      })
      recordDuration('onboarding-middleware', timer.end(), 'success')
      return request
    }

    logger.info('Checking onboarding status', {
      pathname,
      companyId: tenant.companyId,
      userId: auth?.userId,
      wizardParam: searchParams.get('wizard'),
    })

    // CRITICAL: Check wizard exception FIRST
    // This prevents infinite redirect loops when accessing wizard with ?wizard=true
    if (shouldApplyWizardException(pathname, searchParams)) {
      // User is in wizard mode - allow access even if onboarding incomplete
      logger.info('Wizard exception applied - allowing access', {
        pathname,
        companyId: tenant.companyId,
      })

      recordDuration('onboarding-middleware', timer.end(), 'success')

      // Add wizard context to request
      const wizardResult = detectWizardAccess(request)
      if (wizardResult.isWizard) {
        return {
          ...request,
          middlewareContext: {
            ...request.middlewareContext,
            wizard: wizardResult.context,
          },
        } as MiddlewareRequest
      }
    }

    try {
      // Check for incomplete properties
      const { data: incompleteProperties } = await supabase
        .from('properties')
        .select('id')
        .eq('company_id', tenant.companyId)
        .eq('onboarding_completed', false)
        .limit(1)

      // If any properties are incomplete, redirect to onboarding entry point
      if (incompleteProperties && incompleteProperties.length > 0) {
        const url = new URL('/onboarding', request.nextUrl.origin)

        logger.info('Redirecting to onboarding - incomplete properties', {
          from: pathname,
          to: url.pathname,
          companyId: tenant.companyId,
          incompleteCount: incompleteProperties.length,
        })

        // CRITICAL: Check for redirect loops before redirecting
        // This prevents the Oct 30, 2025 incident scenario
        if (!RedirectLoopDetector.check(request, url.pathname)) {
          // Loop detected - allow access to prevent stuck users
          logger.error(
            'Redirect loop detected in onboarding middleware',
            new Error('Onboarding redirect loop'),
            {
              pathname,
              targetPath: url.pathname,
              companyId: tenant.companyId,
            }
          )
          recordRedirectLoopPrevented('onboarding-middleware', pathname)
          recordDuration('onboarding-middleware', timer.end(), 'failure')
          return request
        }

        recordRedirect('onboarding-middleware', url.pathname)
        recordDuration('onboarding-middleware', timer.end(), 'redirect')

        const response = NextResponse.redirect(url)
        RedirectLoopDetector.incrementCount(response)
        return response
      }

      logger.info('Onboarding complete', { companyId: tenant.companyId })

      recordDuration('onboarding-middleware', timer.end(), 'success')

      // Onboarding complete - continue
      return request
    } catch (error) {
      recordError('onboarding-middleware', 'onboarding_check_error')
      recordDuration('onboarding-middleware', timer.end(), 'failure')
      throw error
    }
  }
}
