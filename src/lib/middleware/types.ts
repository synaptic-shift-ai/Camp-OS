/**
 * Core Middleware Type Definitions
 *
 * CAM-135: Implement Core Middleware Types
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * This module provides type-safe abstractions for the middleware system,
 * ensuring proper type safety throughout the request/response chain.
 *
 * Following CLAUDE.md C-5: Use branded types for domain IDs
 * Following CLAUDE.md C-6: Use import type for type-only imports
 */

import type { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Branded Type Utilities
// ============================================================================

/**
 * Brand utility type for creating nominal types
 * Prevents accidental mixing of structurally identical types
 */
declare const __brand: unique symbol
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand }

// ============================================================================
// Domain ID Types (Branded)
// ============================================================================

/**
 * User ID from Supabase Auth (UUID)
 * Branded to prevent mixing with other UUID types
 */
export type UserId = Brand<string, 'UserId'>

/**
 * Company ID (tenant identifier at billing level)
 * Branded to prevent mixing with property IDs
 */
export type CompanyId = Brand<string, 'CompanyId'>

/**
 * Property ID (campground location identifier)
 * Branded to prevent mixing with company IDs
 */
export type PropertyId = Brand<string, 'PropertyId'>

/**
 * Session ID for request tracking
 * Branded for distributed tracing
 */
export type SessionId = Brand<string, 'SessionId'>

// ============================================================================
// Middleware Context Types (Branded)
// ============================================================================

/**
 * Authentication context after successful auth verification
 * Branded to ensure middleware chain properly validates auth state
 */
declare const AuthContextBrand: unique symbol
export type AuthContext = {
  readonly [AuthContextBrand]: typeof AuthContextBrand
  readonly userId: UserId
  readonly email: string
  readonly emailVerified: boolean
  readonly emailConfirmedAt: string | null
  readonly userMetadata: {
    user_type?: 'buyer' | 'explorer' | 'staff'
    [key: string]: unknown
  }
}

/**
 * Tenant context after subscription and company verification
 * Branded to ensure tenant isolation at compile time
 */
declare const TenantContextBrand: unique symbol
export type TenantContext = {
  readonly [TenantContextBrand]: typeof TenantContextBrand
  readonly companyId: CompanyId
  readonly subscriptionStatus: 'active' | 'canceled' | 'past_due'
  readonly subscriptionPlan?: string
  readonly stripeCustomerId?: string
}

/**
 * Onboarding context after property setup verification
 * Indicates whether user has completed initial setup
 */
declare const OnboardingContextBrand: unique symbol
export type OnboardingContext = {
  readonly [OnboardingContextBrand]: typeof OnboardingContextBrand
  readonly hasIncompleteProperties: boolean
  readonly propertyIds: PropertyId[]
}

/**
 * Wizard context indicating user is in onboarding wizard
 * CRITICAL: This context type prevents infinite redirect loops
 * by explicitly marking wizard access exceptions
 */
declare const WizardContextBrand: unique symbol
export type WizardContext = {
  readonly [WizardContextBrand]: typeof WizardContextBrand
  readonly inWizard: true
  readonly wizardQueryParam: string
}

/**
 * Complete middleware context
 * Accumulates state as request passes through middleware chain
 */
export type MiddlewareContext = {
  readonly sessionId: SessionId
  readonly pathname: string
  readonly searchParams: URLSearchParams
  readonly origin: string
  readonly auth?: AuthContext
  readonly tenant?: TenantContext
  readonly onboarding?: OnboardingContext
  readonly wizard?: WizardContext
}

// ============================================================================
// Request/Response Type Extensions
// ============================================================================

/**
 * Next.js request extended with middleware context
 * Use this type in middleware functions to access accumulated state
 */
export type MiddlewareRequest = NextRequest & {
  middlewareContext: MiddlewareContext
}

/**
 * Request after authentication middleware has run
 * Guarantees auth context is present
 */
export type AuthenticatedRequest = MiddlewareRequest & {
  middlewareContext: MiddlewareContext & {
    auth: AuthContext
  }
}

/**
 * Request after tenant middleware has run
 * Guarantees both auth and tenant context are present
 * Use this type for multi-tenant data access
 */
export type TenantResolvedRequest = AuthenticatedRequest & {
  middlewareContext: MiddlewareContext & {
    auth: AuthContext
    tenant: TenantContext
  }
}

/**
 * Request in wizard mode
 * Guarantees wizard context is present, allowing onboarding access
 */
export type WizardRequest = MiddlewareRequest & {
  middlewareContext: MiddlewareContext & {
    wizard: WizardContext
  }
}

// ============================================================================
// Middleware Function Signatures
// ============================================================================

/**
 * Standard middleware function signature
 * Takes a request with context, returns response or updated request
 */
export type MiddlewareFunction = (
  request: MiddlewareRequest
) => Promise<NextResponse | MiddlewareRequest>

/**
 * Middleware handler that requires authentication
 * Ensures auth context is present at compile time
 */
export type AuthenticatedMiddlewareFunction = (
  request: AuthenticatedRequest
) => Promise<NextResponse | MiddlewareRequest>

/**
 * Middleware handler that requires tenant context
 * Ensures both auth and tenant context are present
 */
export type TenantMiddlewareFunction = (
  request: TenantResolvedRequest
) => Promise<NextResponse | MiddlewareRequest>

/**
 * Middleware composition function
 * Chains multiple middleware functions in sequence
 */
export type MiddlewareComposer = (
  ...middlewares: MiddlewareFunction[]
) => MiddlewareFunction

// ============================================================================
// Route Configuration Types
// ============================================================================

/**
 * Route protection requirements
 * Type-safe configuration for which checks a route requires
 */
export type RouteProtection = {
  readonly requiresAuth: boolean
  readonly requiresEmailVerification: boolean
  readonly requiresSubscription: boolean
  readonly requiresOnboarding: boolean
  readonly allowsWizardException: boolean
}

/**
 * Route pattern for matching paths
 * Supports exact match and prefix matching
 */
export type RoutePattern = {
  readonly pattern: string
  readonly matchType: 'exact' | 'prefix'
}

/**
 * Complete route configuration
 * Defines both matching pattern and protection requirements
 */
export type RouteConfig = {
  readonly routes: RoutePattern[]
  readonly protection: RouteProtection
  readonly redirectTo?: string
}

/**
 * Middleware configuration for all routes
 * Centralized, type-safe route rules
 */
export type MiddlewareConfig = {
  readonly routes: {
    readonly public: RouteConfig
    readonly authenticated: RouteConfig
    readonly subscription: RouteConfig
    readonly dashboard: RouteConfig
    readonly onboarding: RouteConfig
    readonly wizard: RouteConfig
  }
}

// ============================================================================
// Redirect Types
// ============================================================================

/**
 * Redirect reason for observability
 * Helps track why users are being redirected
 */
export type RedirectReason =
  | 'unauthenticated'
  | 'email_unverified'
  | 'no_subscription'
  | 'subscription_inactive'
  | 'onboarding_incomplete'
  | 'redirect_loop_detected'

/**
 * Redirect context for building redirect responses
 * Includes original intent and reason for redirect
 */
export type RedirectContext = {
  readonly reason: RedirectReason
  readonly targetPath: string
  readonly originalPath: string
  readonly preserveQuery: boolean
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Middleware error with context
 * Provides actionable error information
 */
export type MiddlewareError = {
  readonly code: string
  readonly message: string
  readonly context?: Record<string, unknown>
  readonly shouldRetry: boolean
}

/**
 * Result type for middleware operations that may fail
 */
export type MiddlewareResult<T> =
  | { success: true; value: T }
  | { success: false; error: MiddlewareError }

// ============================================================================
// Type Guards (Runtime Validation)
// ============================================================================

/**
 * Type guard for AuthContext
 * Validates that auth context is properly structured
 */
export function isAuthContext(ctx: unknown): ctx is AuthContext {
  if (!ctx || typeof ctx !== 'object') return false
  const candidate = ctx as Record<string, unknown>
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.emailVerified === 'boolean' &&
    (candidate.emailConfirmedAt === null ||
      typeof candidate.emailConfirmedAt === 'string') &&
    typeof candidate.userMetadata === 'object' &&
    candidate.userMetadata !== null
  )
}

/**
 * Type guard for TenantContext
 * Validates that tenant context is properly structured
 * CRITICAL for multi-tenant data isolation
 */
export function isTenantContext(ctx: unknown): ctx is TenantContext {
  if (!ctx || typeof ctx !== 'object') return false
  const candidate = ctx as Record<string, unknown>
  return (
    typeof candidate.companyId === 'string' &&
    (candidate.subscriptionStatus === 'active' ||
      candidate.subscriptionStatus === 'canceled' ||
      candidate.subscriptionStatus === 'past_due')
  )
}

/**
 * Type guard for WizardContext
 * Validates that wizard context is properly structured
 * CRITICAL: Prevents infinite redirect loops
 */
export function isWizardContext(ctx: unknown): ctx is WizardContext {
  if (!ctx || typeof ctx !== 'object') return false
  const candidate = ctx as Record<string, unknown>
  return (
    candidate.inWizard === true &&
    typeof candidate.wizardQueryParam === 'string'
  )
}

/**
 * Type guard for MiddlewareContext
 * Validates complete middleware context structure
 */
export function isMiddlewareContext(ctx: unknown): ctx is MiddlewareContext {
  if (!ctx || typeof ctx !== 'object') return false
  const candidate = ctx as Record<string, unknown>

  // Required fields
  if (
    typeof candidate.sessionId !== 'string' ||
    typeof candidate.pathname !== 'string' ||
    !(candidate.searchParams instanceof URLSearchParams) ||
    typeof candidate.origin !== 'string'
  ) {
    return false
  }

  // Optional fields (must be valid if present)
  if (candidate.auth !== undefined && !isAuthContext(candidate.auth)) {
    return false
  }
  if (candidate.tenant !== undefined && !isTenantContext(candidate.tenant)) {
    return false
  }
  if (candidate.wizard !== undefined && !isWizardContext(candidate.wizard)) {
    return false
  }

  return true
}

/**
 * Type guard for AuthenticatedRequest
 * Ensures request has valid auth context
 */
export function isAuthenticatedRequest(
  req: MiddlewareRequest
): req is AuthenticatedRequest {
  return isAuthContext(req.middlewareContext.auth)
}

/**
 * Type guard for TenantResolvedRequest
 * Ensures request has both auth and tenant context
 * CRITICAL for multi-tenant operations
 */
export function isTenantResolvedRequest(
  req: MiddlewareRequest
): req is TenantResolvedRequest {
  return (
    isAuthContext(req.middlewareContext.auth) &&
    isTenantContext(req.middlewareContext.tenant)
  )
}

/**
 * Type guard for WizardRequest
 * Ensures request has wizard context
 */
export function isWizardRequest(
  req: MiddlewareRequest
): req is WizardRequest {
  return isWizardContext(req.middlewareContext.wizard)
}

// ============================================================================
// Helper Type Constructors
// ============================================================================

/**
 * Create a branded UserId from a string
 * Use for database query results or external inputs
 */
export function createUserId(id: string): UserId {
  return id as UserId
}

/**
 * Create a branded CompanyId from a string
 * Use for database query results or external inputs
 */
export function createCompanyId(id: string): CompanyId {
  return id as CompanyId
}

/**
 * Create a branded PropertyId from a string
 * Use for database query results or external inputs
 */
export function createPropertyId(id: string): PropertyId {
  return id as PropertyId
}

/**
 * Create a branded SessionId from a string
 * Use for request tracking and distributed tracing
 */
export function createSessionId(id: string): SessionId {
  return id as SessionId
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Re-export Next.js types for convenience
 * Allows middleware files to import everything from this module
 */
export type { NextRequest, NextResponse, SupabaseClient }
