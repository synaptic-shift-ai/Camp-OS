/**
 * Guest Payment Method (Detach)
 *
 * DELETE /api/v1/guest/payment-methods/[id]
 *
 * Detaches a saved payment method from a guest.
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
 * DELETE /api/v1/guest/payment-methods/[id]
 *
 * Query params: property_id, guest_id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentMethodId } = await params
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

    // Verify guest belongs to property
    const { data: guest, error: guestError } = await serviceRole
      .from('guests')
      .select('id')
      .eq('id', guestId)
      .eq('property_id', propertyId)
      .single()

    if (guestError || !guest) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found')
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
    } catch (procErr: unknown) {
      const msg = procErr instanceof Error ? procErr.message : 'Payment processor not configured'
      return error(ErrorCodes.VALIDATION_ERROR, msg)
    }

    await processor.detachPaymentMethod(paymentMethodId)

    return success({ detached: true })
  } catch (err: unknown) {
    console.error('[Guest Payment Method] Detach error:', err)
    const message = err instanceof Error ? err.message : 'Failed to detach payment method'
    return error(ErrorCodes.INTERNAL_ERROR, 'Failed to detach payment method', { message })
  }
}
