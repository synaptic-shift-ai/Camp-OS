/**
 * Stripe PaymentIntent Creation API Route
 *
 * Creates a PaymentIntent for a pending reservation.
 * Called after reservation is created but before payment is collected.
 *
 * Flow:
 * 1. Validate reservation exists and is pending
 * 2. Create Stripe PaymentIntent with reservation metadata
 * 3. Return client_secret for frontend PaymentElement
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Database } from '@/contracts/db'
import { readMoneyDualMode } from '@/compat/money'

type Reservation = Database['public']['Tables']['reservations']['Row']

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservation_id, property_id } = body

    // Validate required fields
    if (!reservation_id || !property_id) {
      return NextResponse.json(
        { error: 'Missing required fields: reservation_id, property_id' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Fetch the reservation with guest details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*, guest:guests(*)')
      .eq('id', reservation_id)
      .eq('property_id', property_id) // Tenant isolation
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }

    const typedReservation = reservation as Reservation & { guest: any }

    // Verify reservation is in pending state
    if (typedReservation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Reservation is not in pending state' },
        { status: 400 }
      )
    }

    // Phase 2b: Dual-read from old DECIMAL and new BIGINT cents columns
    // Prefers new cents column, falls back to old dollars column
    const amountInCents = readMoneyDualMode(
      typedReservation.total_amount,       // old DECIMAL column (dollars)
      typedReservation.total_amount_cents  // new BIGINT column (cents)
    )

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        reservation_id: reservation_id,
        property_id: property_id,
        confirmation_number: typedReservation.confirmation_number,
        guest_email: typedReservation.guest.email,
      },
      description: `Campsite reservation ${typedReservation.confirmation_number}`,
      receipt_email: typedReservation.guest.email,
    })

    // Store PaymentIntent ID in reservation for reference
    await supabase
      .from('reservations')
      .update({
        // Store in notes for now - could add dedicated column
        notes: `Stripe PaymentIntent: ${paymentIntent.id}`,
      })
      .eq('id', reservation_id)

    // Return client_secret for frontend
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error: any) {
    console.error('Error creating PaymentIntent:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
