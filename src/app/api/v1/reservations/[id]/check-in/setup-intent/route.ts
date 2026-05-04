/**
 * SetupIntent API for Incidentals Card-on-File
 *
 * POST /api/v1/reservations/[id]/check-in/setup-intent
 *
 * Creates a Stripe SetupIntent for collecting a separate card for incidentals.
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

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { getTenantStripeClient, createTenantRequestOptions } from '@/lib/stripe/tenant-client'
import type Stripe from 'stripe'

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
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Fetch reservation
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new GetReservationQueryHandler(repository)
    const reservation = await queryHandler.execute({ id: reservationId })

    if (!reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // RBAC: verify user has staff access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.propertyId,
      minimumRole: 'staff',
    })
    if (isDenied(access)) return access

    // Validate reservation status
    if (reservation.status !== 'confirmed') {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Reservation must be confirmed to set up incidentals card'),
        { status: 400 }
      )
    }

    // Get tenant Stripe client
    const tenantStripeResult = await getTenantStripeClient(reservation.propertyId)
    if (!tenantStripeResult.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, tenantStripeResult.error),
        { status: 400 }
      )
    }

    const { stripe, stripeAccountId } = tenantStripeResult
    const stripeOptions = createTenantRequestOptions(stripeAccountId)

    // Fetch guest record for Stripe customer
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('id, email, first_name, last_name, phone, stripe_customer_id')
      .eq('id', reservation.guestId)
      .eq('property_id', reservation.propertyId)
      .single()

    if (guestError || !guest) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found'),
        { status: 404 }
      )
    }

    const typedGuest = guest as {
      id: string
      email: string
      first_name: string | null
      last_name: string | null
      phone: string | null
      stripe_customer_id: string | null
    }

    // Get or create Stripe Customer
    let stripeCustomerId = typedGuest.stripe_customer_id

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: typedGuest.email,
          name: [typedGuest.first_name, typedGuest.last_name].filter(Boolean).join(' ').trim() || typedGuest.email,
          ...(typedGuest.phone ? { phone: typedGuest.phone } : {}),
          metadata: {
            guest_id: typedGuest.id,
            property_id: reservation.propertyId,
          },
        },
        stripeOptions,
      )

      stripeCustomerId = customer.id

      // Persist stripe_customer_id to guest record
      const { error: updateGuestError } = await supabase
        .from('guests')
        .update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', typedGuest.id)
        .eq('property_id', reservation.propertyId)

      if (updateGuestError) {
        console.error('[SetupIntent] Failed to save stripe_customer_id to guest', updateGuestError)
        // Continue — customer was created, just not persisted
      }
    }

    // Create SetupIntent for off-session incidentals charges
    const setupIntent = await stripe.setupIntents.create(
      {
        customer: stripeCustomerId,
        usage: 'off_session',
        metadata: {
          reservation_id: reservationId,
          property_id: reservation.propertyId,
        },
      },
      stripeOptions,
    )

    return success({
      client_secret: setupIntent.client_secret,
      setup_intent_id: setupIntent.id,
    })
  } catch (err: any) {
    console.error('[SetupIntent] Error creating SetupIntent:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to create setup intent', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
