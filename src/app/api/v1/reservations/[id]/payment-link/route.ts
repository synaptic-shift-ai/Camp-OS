/**
 * Payment Link Generation API v1
 *
 * POST /api/v1/reservations/[id]/payment-link
 *
 * Generates a Stripe Checkout Session URL for a reservation.
 * Used to send payment links to guests via email for manual bookings.
 */

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { getTenantStripeClient } from '@/lib/stripe/tenant-client'
import {
  GeneratePaymentLinkRequestSchema,
} from '@/types/api/v1/schemas/reservations'
import type { Database } from '@/contracts/db'

type Reservation = Database['public']['Tables']['reservations']['Row']
type Guest = Database['public']['Tables']['guests']['Row']

/**
 * POST /api/v1/reservations/[id]/payment-link
 *
 * Generate a Stripe Checkout Session URL for guest payment.
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
      return error(ErrorCodes.AUTH_001, request)
    }

    // Parse request body (optional)
    let body = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is acceptable
    }

    const parsed = GeneratePaymentLinkRequestSchema.safeParse(body)
    if (!parsed.success) {
      return error(
        ErrorCodes.VAL_001,
        request,
        { validationErrors: parsed.error.format() }
      )
    }

    const { amountCents } = parsed.data

    // Fetch reservation with guest and property details
    const supabaseServiceRole = createServiceRoleClient()
    const { data: reservation, error: reservationError } = await supabaseServiceRole
      .from('reservations')
      .select(`
        *,
        guest:guests(*),
        site:sites(id, name),
        property:properties(id, name, owner_id)
      `)
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return error(ErrorCodes.RES_001, request)
    }

    // Validate property_id exists (required for tenant isolation)
    if (!reservation.property_id) {
      return error(ErrorCodes.RES_001, request, { message: 'Reservation has no associated property' })
    }

    const typedReservation = reservation as Reservation & {
      guest: Guest
      site: { id: string; name: string }
      property: { id: string; name: string; owner_id: string }
      property_id: string // Narrow the type after validation
    }

    // Verify user has access to this property (BP-4: Multi-tenant isolation)
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    const isOwner = typedReservation.property.owner_id === user.id
    const hasCompanyAccess = company !== null

    if (!isOwner && !hasCompanyAccess) {
      return error(ErrorCodes.AUTH_002, request)
    }

    // Validate reservation can receive payment
    if (typedReservation.payment_status === 'paid') {
      return error(
        ErrorCodes.PAY_005,
        request,
        { message: 'Reservation is already fully paid' }
      )
    }

    // Determine amount to charge
    const paidAmount = typedReservation.paid_amount || 0
    const totalAmount = typedReservation.total_amount
    const remainingBalance = totalAmount - paidAmount

    let amountToCharge = amountCents
    if (!amountToCharge) {
      amountToCharge = remainingBalance
    }

    if (amountToCharge <= 0) {
      return error(
        ErrorCodes.VAL_007,
        request,
        { message: 'Amount must be greater than 0' }
      )
    }

    if (amountToCharge > remainingBalance) {
      return error(
        ErrorCodes.VAL_007,
        request,
        { message: `Amount exceeds remaining balance. Maximum: ${remainingBalance} cents`, remainingBalance }
      )
    }

    // Get tenant's Stripe client
    const tenantStripeResult = await getTenantStripeClient(typedReservation.property_id)
    if (!tenantStripeResult.success) {
      return error(ErrorCodes.PROP_005, request, { message: tenantStripeResult.error })
    }

    const { stripe, stripeAccountId } = tenantStripeResult

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    const successUrl = `${baseUrl}/payment/reservation-success?session_id={CHECKOUT_SESSION_ID}&reservation=${reservationId}`
    const cancelUrl = `${baseUrl}/payment/reservation-cancelled?reservation=${reservationId}`

    // Calculate nights for description
    const checkIn = new Date(typedReservation.check_in_date)
    const checkOut = new Date(typedReservation.check_out_date)
    const numNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Reservation at ${typedReservation.property.name}`,
              description: `${typedReservation.site?.name || 'Site'} - ${numNights} night${numNights !== 1 ? 's' : ''} (${typedReservation.check_in_date} to ${typedReservation.check_out_date})`,
            },
            unit_amount: amountToCharge,
          },
          quantity: 1,
        },
      ],
      customer_email: typedReservation.guest?.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      metadata: {
        reservation_id: reservationId,
        property_id: typedReservation.property_id,
        confirmation_number: typedReservation.confirmation_number,
        guest_id: typedReservation.guest_id,
        amount_cents: amountToCharge.toString(),
        payment_type: 'manual_booking_payment',
      },
      payment_intent_data: {
        description: `Campsite reservation ${typedReservation.confirmation_number}`,
        metadata: {
          reservation_id: reservationId,
          property_id: typedReservation.property_id,
          confirmation_number: typedReservation.confirmation_number,
        },
        transfer_data: {
          destination: stripeAccountId,
        },
        on_behalf_of: stripeAccountId,
      },
    })

    // Log checkout session on reservation
    await supabaseServiceRole
      .from('reservations')
      .update({
        notes: typedReservation.notes
          ? `${typedReservation.notes}\nPayment link generated: ${checkoutSession.id}`
          : `Payment link generated: ${checkoutSession.id}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId)

    // TODO: If sendEmail is true, send email with payment link
    // This would integrate with the email service

    return success(
      {
        url: checkoutSession.url!,
        checkoutSessionId: checkoutSession.id,
        amountCents: amountToCharge,
        expiresAt: new Date(checkoutSession.expires_at * 1000).toISOString(),
      },
      request
    )
  } catch (err) {
    console.error('[Payment Link v1] Unexpected error:', err)
    return error(ErrorCodes.SYS_001, request)
  }
}
