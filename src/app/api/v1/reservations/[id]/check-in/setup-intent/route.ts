/**
 * SetupIntent API for Incidentals Card-on-File
 *
 * POST /api/v1/reservations/[id]/check-in/setup-intent
 *
 * Creates a SetupIntent for collecting a separate card for incidentals.
 * Uses the IPaymentProcessor abstraction (works with Stripe, CampOS Payments, etc.).
 * The SetupIntent does not charge the card — it only stores it for future off-session use.
 *
 * Flow:
 * 1. Auth + RBAC check (staff minimum)
 * 2. Fetch reservation via DDD
 * 3. Validate reservation exists and is in 'confirmed' status
 * 4. Get the guest's stripe_customer_id; create one if missing
 * 5. Create SetupIntent with usage=off_session
 * 6. Return client_secret for frontend Stripe Elements
 */

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { resolvePaymentProcessor } from '@/lib/config/resolution'
import { getProcessor } from '@/modules/Financial/infrastructure/ProcessorFactory'
import type { IPaymentProcessor } from '@/modules/Financial/infrastructure/IPaymentProcessor'

/**
 * POST /api/v1/reservations/[id]/check-in/setup-intent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, 'Unauthorized')
    }

    // Fetch reservation
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new GetReservationQueryHandler(repository)
    const reservation = await queryHandler.execute({ id: reservationId })

    if (!reservation) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found')
    }

    // RBAC: verify user has staff access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.propertyId,
      minimumRole: 'staff',
    })
    if (isDenied(access)) return access

    // Validate reservation status
    if (reservation.status !== 'confirmed') {
      return error(ErrorCodes.VALIDATION_ERROR, 'Reservation must be confirmed to set up incidentals card')
    }

    // Get tenant payment processor
    const { data: property } = await supabase
      .from('properties')
      .select('payment_processor, stripe_account_id')
      .eq('id', reservation.propertyId)
      .single()

    const processorType = resolvePaymentProcessor(property?.payment_processor)
    let processor: IPaymentProcessor
    try {
      processor = getProcessor(processorType, property?.stripe_account_id ?? undefined)
    } catch (procErr: unknown) {
      const msg = procErr instanceof Error ? procErr.message : 'Payment processor not configured'
      return error(ErrorCodes.VALIDATION_ERROR, msg)
    }

    // Fetch guest record for Stripe customer
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('id, email, first_name, last_name, phone, stripe_customer_id')
      .eq('id', reservation.guestId)
      .eq('property_id', reservation.propertyId)
      .single()

    if (guestError || !guest) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found')
    }

    const typedGuest = guest as {
      id: string
      email: string
      first_name: string | null
      last_name: string | null
      phone: string | null
      stripe_customer_id: string | null
    }

    const createAndPersistStripeCustomer = async (): Promise<string> => {
      const customer = await processor.createCustomer({
        email: typedGuest.email,
        name: [typedGuest.first_name, typedGuest.last_name].filter(Boolean).join(' ').trim() || typedGuest.email,
        ...(typedGuest.phone ? { phone: typedGuest.phone } : {}),
        metadata: {
          guest_id: typedGuest.id,
          property_id: reservation.propertyId,
        },
      })

      const nextStripeCustomerId = customer.customerId
      const { error: updateGuestError } = await supabase
        .from('guests')
        .update({
          stripe_customer_id: nextStripeCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', typedGuest.id)
        .eq('property_id', reservation.propertyId)

      if (updateGuestError) {
        console.error('[SetupIntent] Failed to save stripe_customer_id to guest', updateGuestError)
      }

      return nextStripeCustomerId
    }

    // Get or create Stripe Customer via processor abstraction
    let stripeCustomerId = typedGuest.stripe_customer_id

    if (!stripeCustomerId) {
      stripeCustomerId = await createAndPersistStripeCustomer()
    }

    // Create SetupIntent via processor abstraction (off_session for incidentals)
    let setupIntent
    try {
      setupIntent = await processor.createSetupIntent({
        customerId: stripeCustomerId,
        usage: 'off_session',
        metadata: {
          reservation_id: reservationId,
          property_id: reservation.propertyId,
        },
      })
    } catch (setupIntentError: unknown) {
      const maybeStripeError = setupIntentError as { code?: string; param?: string; message?: string }
      const staleCustomerId =
        maybeStripeError.code === 'resource_missing' &&
        (maybeStripeError.param === 'customer' || maybeStripeError.message?.includes('No such customer'))

      if (!staleCustomerId) throw setupIntentError

      console.warn('[SetupIntent] Stale stripe_customer_id detected; recreating customer and retrying', {
        guestId: typedGuest.id,
        previousStripeCustomerId: stripeCustomerId,
      })

      stripeCustomerId = await createAndPersistStripeCustomer()
      setupIntent = await processor.createSetupIntent({
        customerId: stripeCustomerId,
        usage: 'off_session',
        metadata: {
          reservation_id: reservationId,
          property_id: reservation.propertyId,
        },
      })
    }

    return success({
      client_secret: setupIntent.clientSecret,
      setup_intent_id: setupIntent.setupIntentId,
    })
  } catch (err: unknown) {
    console.error('[SetupIntent] Error creating SetupIntent:', err)
    const message = err instanceof Error ? err.message : 'Failed to create setup intent'
    return error(ErrorCodes.INTERNAL_ERROR, 'Failed to create setup intent', { message })
  }
}
