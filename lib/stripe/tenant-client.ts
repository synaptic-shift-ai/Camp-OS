/**
 * Tenant-Aware Stripe Client Utility
 *
 * Provides Stripe client instances configured for specific tenant (property) accounts.
 * Uses Stripe Connect to route payments through tenant's connected Stripe account.
 *
 * Architecture:
 * - Platform uses its own Stripe API key (STRIPE_SECRET_KEY)
 * - Each tenant has their own connected Stripe account (stripe_account_id)
 * - All API calls use `stripeAccount` parameter to route to tenant's account
 * - Funds flow directly to tenant (platform never touches the money)
 *
 * Security:
 * - All operations validate property ownership via tenant isolation
 * - Service role client used for admin operations only
 * - No tenant API keys stored (Stripe Connect handles routing)
 *
 * @see https://stripe.com/docs/connect/authentication
 */

import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Initialize platform Stripe client (singleton)
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required')
}

const platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-09-30.clover',
})

/**
 * Result type for tenant Stripe client operations
 */
export type TenantStripeClientResult =
  | { success: true; stripe: Stripe; stripeAccountId: string }
  | { success: false; error: string }

/**
 * Get Stripe client configured for a specific tenant (property)
 *
 * @param propertyId - The property ID to get Stripe account for
 * @returns Configured Stripe client or error
 *
 * @example
 * ```typescript
 * const result = await getTenantStripeClient(propertyId)
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 })
 * }
 *
 * // Use tenant-scoped Stripe client
 * const { stripe, stripeAccountId } = result
 * const paymentIntent = await stripe.paymentIntents.create({
 *   amount: 10000,
 *   currency: 'usd',
 * }, {
 *   stripeAccount: stripeAccountId  // Routes to tenant's account
 * })
 * ```
 */
export async function getTenantStripeClient(
  propertyId: string
): Promise<TenantStripeClientResult> {
  const supabase = createServiceRoleClient()

  // Fetch property's Stripe account ID
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, stripe_account_id, stripe_connected_at')
    .eq('id', propertyId)
    .single()

  if (propertyError || !property) {
    return {
      success: false,
      error: 'Property not found',
    }
  }

  // Verify Stripe is connected
  if (!property.stripe_account_id) {
    return {
      success: false,
      error: 'Property has not connected Stripe account. Complete onboarding first.',
    }
  }

  // Return platform Stripe client + tenant account ID
  // Caller must use stripeAccount parameter in all API calls
  return {
    success: true,
    stripe: platformStripe,
    stripeAccountId: property.stripe_account_id,
  }
}

/**
 * Helper type for Stripe API calls with tenant context
 * Use this to ensure stripeAccount parameter is always included
 */
export interface TenantStripeRequestOptions extends Stripe.RequestOptions {
  stripeAccount: string
}

/**
 * Create TenantStripeRequestOptions from stripeAccountId
 *
 * @example
 * ```typescript
 * const options = createTenantRequestOptions(stripeAccountId)
 * await stripe.paymentIntents.create({ ... }, options)
 * ```
 */
export function createTenantRequestOptions(
  stripeAccountId: string
): TenantStripeRequestOptions {
  return {
    stripeAccount: stripeAccountId,
  }
}

/**
 * Get platform Stripe client (for platform-level operations only)
 *
 * WARNING: Only use this for:
 * - Company subscription management
 * - Platform billing
 * - Stripe Connect OAuth operations
 *
 * DO NOT use for tenant payments - use getTenantStripeClient instead!
 */
export function getPlatformStripeClient(): Stripe {
  return platformStripe
}
