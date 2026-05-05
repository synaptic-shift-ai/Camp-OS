/**
 * Guest Payment Methods
 *
 * GET /api/v1/guest/payment-methods
 *
 * Lists saved payment methods for a guest.
 * Requires staff auth with financial.record_payment permission.
 * Uses the IPaymentProcessor abstraction.
 */

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { resolvePaymentProcessor } from '@/lib/config/resolution'
import { getProcessor } from '@/modules/Financial/infrastructure/ProcessorFactory'
import type { IPaymentProcessor } from '@/modules/Financial/infrastructure/IPaymentProcessor'

/**
 * GET /api/v1/guest/payment-methods
 *
 * Query params: property_id, guest_id
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, 'Unauthorized')
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    const guestId = searchParams.get('guest_id')

    if (!propertyId || !guestId) {
      return error(ErrorCodes.VALIDATION_ERROR, 'property_id and guest_id are required')
    }

    // RBAC: require financial.record_payment permission
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'financial.record_payment',
    })
    if (isDenied(access)) return access

    const serviceRole = createServiceRoleClient()

    // Look up guest to get stripe_customer_id
    const { data: guest, error: guestError } = await serviceRole
      .from('guests')
      .select('id, stripe_customer_id')
      .eq('id', guestId)
      .eq('property_id', propertyId)
      .single()

    if (guestError || !guest) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found')
    }

    if (!guest.stripe_customer_id) {
      // No Stripe customer — no saved cards
      return success({ payment_methods: [] })
    }

    // Get property config for processor resolution
    const { data: property } = await serviceRole
      .from('properties')
      .select('payment_processor, stripe_account_id')
      .eq('id', propertyId)
      .single()

    const processorType = resolvePaymentProcessor(property?.payment_processor)
    let processor: IPaymentProcessor
    try {
      processor = getProcessor(processorType, property?.stripe_account_id ?? undefined)
    } catch {
      // No processor configured — return empty
      return success({ payment_methods: [] })
    }

    const paymentMethods = await processor.listPaymentMethods(guest.stripe_customer_id)

    return success({
      payment_methods: paymentMethods.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              exp_month: pm.card.expMonth,
              exp_year: pm.card.expYear,
            }
          : null,
      })),
    })
  } catch (err: unknown) {
    console.error('[Guest Payment Methods] Error:', err)
    const message = err instanceof Error ? err.message : 'Failed to list payment methods'
    return error(ErrorCodes.INTERNAL_ERROR, 'Failed to list payment methods', { message })
  }
}
