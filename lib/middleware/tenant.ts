/**
 * Tenant Resolution Middleware
 *
 * CAM-137: Refactor Tenant Middleware with Isolation Guarantees
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * SINGLE RESPONSIBILITY: Resolve tenant context and validate subscription
 *
 * What this middleware does:
 * - Resolves company (tenant) from authenticated user
 * - Validates subscription status with Stripe
 * - Adds TenantContext to request.middlewareContext
 * - Ensures multi-tenant data isolation
 *
 * What this middleware DOES NOT do:
 * - Redirect logic (delegated to route handlers)
 * - Property selection (delegated to property middleware)
 * - Onboarding checks (delegated to onboarding middleware)
 *
 * Following CLAUDE.md:
 * - C-5: Use branded types for domain IDs (CompanyId)
 * - C-6: Use import type for type-only imports
 * - BP-4: Proper multi-tenant isolation (CRITICAL)
 * - D-2: Always include tenant_id in WHERE clauses
 * - D-3: Use Row Level Security (RLS) policies
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AuthenticatedRequest,
  TenantResolvedRequest,
  TenantContext,
  CompanyId,
} from './types'
import { createCompanyId } from './types'

/**
 * Tenant resolution result
 * Separation of verification from handling allows route middleware to decide how to respond
 */
export type TenantResult =
  | { resolved: true; request: TenantResolvedRequest }
  | { resolved: false; reason: TenantFailureReason }

/**
 * Reasons why tenant resolution failed
 * Provides actionable context for route handlers
 */
export type TenantFailureReason =
  | 'no_company'
  | 'subscription_inactive'
  | 'subscription_past_due'
  | 'subscription_canceled'
  | 'database_error'

/**
 * Company data from database
 * Represents the billing entity for multi-tenant isolation
 */
type CompanyData = {
  id: string
  name: string
  owner_id: string
  stripe_customer_id: string | null
  subscription_id: string | null
  subscription_status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | null
  subscription_plan: string | null
}

/**
 * Tenant resolution function
 *
 * PURE FUNCTION: Minimal side effects (database read only)
 * Takes authenticated request and Supabase client, returns tenant result
 *
 * CRITICAL: This function ensures multi-tenant data isolation
 * - Queries companies table with RLS policies
 * - Validates subscription status
 * - Adds TenantContext to request for downstream middleware
 *
 * @param request - Authenticated request with user context
 * @param supabase - Supabase client for database queries
 * @returns Tenant resolution result with success/failure reason
 */
export async function resolveTenant(
  request: AuthenticatedRequest,
  supabase: SupabaseClient
): Promise<TenantResult> {
  const { auth } = request.middlewareContext

  // Query companies table for user's company
  // RLS policy ensures user can only access their own companies
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, owner_id, stripe_customer_id, subscription_id, subscription_status, subscription_plan')
    .eq('owner_id', auth.userId)
    .limit(1)

  // Database error - return error reason
  if (error) {
    return {
      resolved: false,
      reason: 'database_error',
    }
  }

  // No company found - user hasn't created a company yet
  if (!companies || companies.length === 0) {
    return {
      resolved: false,
      reason: 'no_company',
    }
  }

  const company = companies[0] as CompanyData

  // Validate subscription status
  const validationResult = validateSubscriptionStatus(company)
  if (!validationResult.valid) {
    return {
      resolved: false,
      reason: validationResult.reason,
    }
  }

  // Create tenant context with branded types
  const tenantContext: TenantContext = {
    companyId: createCompanyId(company.id),
    subscriptionStatus: company.subscription_status as 'active' | 'canceled' | 'past_due',
    subscriptionPlan: company.subscription_plan ?? undefined,
    stripeCustomerId: company.stripe_customer_id ?? undefined,
  } as TenantContext

  // Add tenant context to request
  const tenantResolvedRequest: TenantResolvedRequest = {
    ...request,
    middlewareContext: {
      ...request.middlewareContext,
      tenant: tenantContext,
    },
  } as TenantResolvedRequest

  return {
    resolved: true,
    request: tenantResolvedRequest,
  }
}

/**
 * Subscription status validation result
 */
type SubscriptionValidation =
  | { valid: true }
  | { valid: false; reason: TenantFailureReason }

/**
 * Validate subscription status
 *
 * PURE FUNCTION: No side effects
 * Implements subscription decision tree from CAM-133
 *
 * Business Rules:
 * - 'active' status: Valid
 * - 'past_due' status: Invalid (payment failed, grace period)
 * - 'canceled' status: Invalid (user canceled, access revoked)
 * - 'unpaid' or 'incomplete' status: Invalid (payment incomplete)
 * - null status: Invalid (no subscription)
 *
 * @param company - Company data with subscription status
 * @returns Validation result
 */
function validateSubscriptionStatus(
  company: CompanyData
): SubscriptionValidation {
  const { subscription_status } = company

  // No subscription status - company hasn't subscribed
  if (!subscription_status) {
    return {
      valid: false,
      reason: 'subscription_inactive',
    }
  }

  // Active subscription - all good
  if (subscription_status === 'active') {
    return { valid: true }
  }

  // Past due - payment failed, in grace period
  if (subscription_status === 'past_due') {
    return {
      valid: false,
      reason: 'subscription_past_due',
    }
  }

  // Canceled - user explicitly canceled
  if (subscription_status === 'canceled') {
    return {
      valid: false,
      reason: 'subscription_canceled',
    }
  }

  // Unpaid or incomplete - invalid subscription
  return {
    valid: false,
    reason: 'subscription_inactive',
  }
}

/**
 * Check if a path requires an active subscription
 *
 * PURE FUNCTION: No side effects
 * Route protection logic separated from tenant resolution
 *
 * @param pathname - Request pathname
 * @returns True if subscription is required
 */
export function requiresActiveSubscription(pathname: string): boolean {
  // Subscription required for dashboard access (business gate)
  // Exception: /dashboard/billing for subscription management
  if (pathname.startsWith('/dashboard')) {
    return !pathname.startsWith('/dashboard/billing')
  }

  return false
}

/**
 * Get company ID from tenant context
 *
 * HELPER: Extract company ID safely
 * Use this in API routes to ensure tenant isolation
 *
 * @param request - Tenant-resolved request
 * @returns Company ID for database queries
 */
export function getCompanyId(request: TenantResolvedRequest): CompanyId {
  return request.middlewareContext.tenant.companyId
}

/**
 * Tenant lookup cache
 * Reduces database queries for same user within request cycle
 *
 * NOTE: Cache is request-scoped, not global
 * Each middleware execution creates new cache instance
 */
class TenantCache {
  private cache = new Map<string, TenantResult>()

  get(userId: string): TenantResult | undefined {
    return this.cache.get(userId)
  }

  set(userId: string, result: TenantResult): void {
    this.cache.set(userId, result)
  }

  clear(): void {
    this.cache.clear()
  }
}

/**
 * Create tenant cache instance
 * Use for request-scoped caching to improve performance
 *
 * @returns New tenant cache instance
 */
export function createTenantCache(): TenantCache {
  return new TenantCache()
}

/**
 * Resolve tenant with caching
 *
 * OPTIMIZED VERSION: Uses cache to avoid duplicate database queries
 * Use this in middleware chains where tenant resolution may be called multiple times
 *
 * @param request - Authenticated request
 * @param supabase - Supabase client
 * @param cache - Tenant cache instance
 * @returns Tenant resolution result
 */
export async function resolveTenantCached(
  request: AuthenticatedRequest,
  supabase: SupabaseClient,
  cache: TenantCache
): Promise<TenantResult> {
  const { auth } = request.middlewareContext
  const userId = auth.userId as string

  // Check cache first
  const cached = cache.get(userId)
  if (cached) {
    return cached
  }

  // Cache miss - resolve tenant
  const result = await resolveTenant(request, supabase)

  // Store in cache
  cache.set(userId, result)

  return result
}
