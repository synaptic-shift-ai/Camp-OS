import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getTenantStripeClient } from '@/lib/stripe/tenant-client'
import { addSentryContext, addTenantContext, captureException } from '@/lib/monitoring/sentry-utils'
import type { Database } from '@/contracts/db'

type Reservation = Database['public']['Tables']['reservations']['Row']
type Guest = Database['public']['Tables']['guests']['Row']

/**
 * @deprecated Use POST /api/v1/reservations/[id]/payment-link instead.
 * This endpoint will be removed on 2025-03-01.
 *
 * Payment Link Generation API (LEGACY)
 *
 * POST /api/admin/reservations/[id]/payment-link
 *
 * Generates a Stripe Checkout Session URL for a reservation.
 * Used to send payment links to guests via email for manual bookings.
 *
 * Flow:
 * 1. Validate reservation exists and belongs to authenticated user's property
 * 2. Get tenant's connected Stripe account
 * 3. Create Stripe Checkout Session with reservation details
 * 4. Return the checkout URL to send to guest
 *
 * Enforces multi-tenant isolation.
 */

interface PaymentLinkRequest {
  /** Amount to charge in cents. Defaults to reservation's amount_due_now or total_amount */
  amount?: number
  /** Whether to send the link via email to the guest */
  sendEmail?: boolean
}

interface PaymentLinkResponse {
  success: true
  url: string
  checkoutSessionId: string
  amount: number
  expiresAt: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params

    // Add Sentry context for debugging
    addSentryContext(request, { reservationId })

    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // Get the user's property (MVP: assumes one property per user)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'No property found for this user.' },
        { status: 404 }
      )
    }

    const propertyId = property.id
    const propertyName = property.name

    // Add tenant context for multi-tenant debugging
    addTenantContext(propertyId, user.id)

    // Parse request body (optional parameters)
    let body: PaymentLinkRequest = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is acceptable - use defaults
    }

    // Fetch the reservation with guest and site details
    const supabaseServiceRole = createServiceRoleClient()
    const { data: reservation, error: reservationError } = await supabaseServiceRole
      .from('reservations')
      .select(`
        *,
        guest:guests(*),
        site:sites(id, name)
      `)
      .eq('id', reservationId)
      .eq('property_id', propertyId) // Tenant isolation
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found or access denied.' },
        { status: 404 }
      )
    }

    const typedReservation = reservation as Reservation & {
      guest: Guest
      site: { id: string; name: string }
    }

    // Validate reservation can receive payment
    if (typedReservation.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Reservation is already fully paid.' },
        { status: 400 }
      )
    }

    // Determine amount to charge
    // Use provided amount, or amount_due_now if available, or remaining balance
    const paidAmount = typedReservation.paid_amount || 0
    const totalAmount = typedReservation.total_amount
    const remainingBalance = totalAmount - paidAmount

    let amountToCharge = body.amount
    if (!amountToCharge) {
      // Default to remaining balance
      amountToCharge = remainingBalance
    }

    if (amountToCharge <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Amount must be greater than 0.' },
        { status: 400 }
      )
    }

    if (amountToCharge > remainingBalance) {
      return NextResponse.json(
        {
          error: `Amount exceeds remaining balance. Maximum amount: ${remainingBalance} cents.`,
          remainingBalance,
        },
        { status: 400 }
      )
    }

    // Get tenant's Stripe client
    const tenantStripeResult = await getTenantStripeClient(propertyId)
    if (!tenantStripeResult.success) {
      return NextResponse.json(
        { error: tenantStripeResult.error },
        { status: 400 }
      )
    }

    const { stripe, stripeAccountId } = tenantStripeResult

    // Build success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/payment/reservation-success?session_id={CHECKOUT_SESSION_ID}&reservation=${reservationId}`
    const cancelUrl = `${baseUrl}/payment/reservation-cancelled?reservation=${reservationId}`

    // Calculate number of nights for description
    const checkIn = new Date(typedReservation.check_in_date)
    const checkOut = new Date(typedReservation.check_out_date)
    const numNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    // Create Stripe Checkout Session
    // Using destination charge pattern for proper Connect fund routing
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Reservation at ${propertyName}`,
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
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
      metadata: {
        reservation_id: reservationId,
        property_id: propertyId,
        confirmation_number: typedReservation.confirmation_number,
        guest_id: typedReservation.guest_id,
        amount_cents: amountToCharge.toString(),
        payment_type: 'manual_booking_payment',
      },
      payment_intent_data: {
        description: `Campsite reservation ${typedReservation.confirmation_number}`,
        metadata: {
          reservation_id: reservationId,
          property_id: propertyId,
          confirmation_number: typedReservation.confirmation_number,
        },
        // Route funds to connected account
        transfer_data: {
          destination: stripeAccountId,
        },
        on_behalf_of: stripeAccountId,
      },
    })

    // Store checkout session ID on reservation for reference
    await supabaseServiceRole
      .from('reservations')
      .update({
        notes: typedReservation.notes
          ? `${typedReservation.notes}\nPayment link sent: ${checkoutSession.id}`
          : `Payment link sent: ${checkoutSession.id}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId)
      .eq('property_id', propertyId)

    // TODO: If sendEmail is true, send email to guest with payment link
    // This would integrate with the email service
    // For now, return the URL for manual sharing

    const response: PaymentLinkResponse = {
      success: true,
      url: checkoutSession.url!,
      checkoutSessionId: checkoutSession.id,
      amount: amountToCharge,
      expiresAt: new Date(checkoutSession.expires_at * 1000).toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Payment Link] Unexpected error:', error)

    // Capture exception in Sentry with context
    if (error instanceof Error) {
      captureException(error, {
        level: 'error',
        tags: { operation: 'generate_payment_link' },
      })
    }

    return NextResponse.json(
      { error: 'Failed to generate payment link.' },
      { status: 500 }
    )
  }
}
