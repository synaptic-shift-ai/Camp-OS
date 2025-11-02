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
    const { pathname } = request.middlewareContext

    // Define routes that require authentication
    const requiresAuth = ['/dashboard', '/onboarding']
    const needsAuth = requiresAuth.some((route) => pathname.startsWith(route))

    // Skip auth check for public routes
    if (!needsAuth) {
      return request
    }

    // Verify authentication
    const authResult = await verifyAuthentication(request, supabase)

    // Not authenticated - redirect to login
    if (!authResult.authenticated) {
      const origin = request.nextUrl?.origin ?? new URL(request.url).origin
      const url = new URL('/login', origin)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // Return authenticated request for next middleware
    return authResult.request
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
    const { pathname, auth } = request.middlewareContext

    // Skip if auth context not present (previous middleware handles this)
    if (!auth) {
      return request
    }

    // Check if this route requires email verification
    if (!requiresEmailVerification(pathname)) {
      return request
    }

    // Email not verified - redirect to verification page
    if (!auth.emailVerified) {
      const origin = request.nextUrl?.origin ?? new URL(request.url).origin
      const url = new URL('/verify-email', origin)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

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
    const { pathname, auth } = request.middlewareContext

    // Skip if auth context not present
    if (!auth) {
      return request
    }

    // Check if this route requires subscription
    if (!requiresActiveSubscription(pathname)) {
      return request
    }

    // Don't redirect if already on payment/plan pages
    if (
      pathname.startsWith('/choose-plan') ||
      pathname.startsWith('/payment')
    ) {
      return request
    }

    // Resolve tenant context (includes subscription check)
    // We know auth is present from previous middleware checks
    // Type guard ensures the request has auth context
    if (!request.middlewareContext.auth) {
      // This should never happen due to middleware order, but TypeScript needs the check
      return request
    }

    const tenantResult = await resolveTenant(
      request as Parameters<typeof resolveTenant>[0],
      supabase
    )

    // No active subscription - redirect to plan selection
    if (!tenantResult.resolved) {
      const origin = request.nextUrl?.origin ?? new URL(request.url).origin
      const url = new URL('/choose-plan', origin)
      return NextResponse.redirect(url)
    }

    // Return tenant-resolved request for next middleware
    return tenantResult.request
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
    const { pathname, searchParams, tenant } = request.middlewareContext

    // Skip if tenant context not present
    if (!tenant) {
      return request
    }

    // Only check onboarding for dashboard routes
    if (!pathname.startsWith('/dashboard')) {
      return request
    }

    // CRITICAL: Check wizard exception FIRST
    // This prevents infinite redirect loops when accessing wizard with ?wizard=true
    if (shouldApplyWizardException(pathname, searchParams)) {
      // User is in wizard mode - allow access even if onboarding incomplete
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

    // Check for incomplete properties
    const { data: incompleteProperties } = await supabase
      .from('properties')
      .select('id')
      .eq('company_id', tenant.companyId)
      .eq('onboarding_completed', false)
      .limit(1)

    // If any properties are incomplete, redirect to onboarding entry point
    if (incompleteProperties && incompleteProperties.length > 0) {
      const origin = request.nextUrl?.origin ?? new URL(request.url).origin
      const url = new URL('/onboarding', origin)
      return NextResponse.redirect(url)
    }

    // Onboarding complete - continue
    return request
  }
}
