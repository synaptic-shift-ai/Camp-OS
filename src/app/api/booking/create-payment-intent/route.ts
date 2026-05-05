/**
 * PaymentIntent Creation API Route
 *
 * Creates a PaymentIntent for a pending reservation.
 * Called after reservation is created but before payment is collected.
 *
 * Uses the property's configured payment processor (Stripe, CampOS Payments, etc.)
 * via the IPaymentProcessor abstraction.
 *
 * Flow:
 * 1. Validate reservation exists and is pending
 * 2. Resolve payment processor from property config
 * 3. Create PaymentIntent via processor abstraction
 * 4. Return client_secret for frontend PaymentElement
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Database } from '@/contracts/db'
import {
  CreatePaymentIntentRequestSchema,
  CreatePaymentIntentResponseSchema,
} from '@/contracts/schemas'
import { resolveDepositConfig, resolvePaymentProcessor } from '@/lib/config/resolution'
import { getProcessor } from '@/modules/Financial/infrastructure/ProcessorFactory'
import type { IPaymentProcessor } from '@/modules/Financial/infrastructure/IPaymentProcessor'

type Reservation = Database['public']['Tables']['reservations']['Row']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Phase 3: Zod validation
    const parsed = CreatePaymentIntentRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { reservation_id, property_id } = parsed.data

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

    // Phase 2c: Direct read from BIGINT column (already in cents)
    const totalAmountCents = typedReservation.total_amount

    // Check if deposit is configured for this property — use deposit amount if active
    let amountInCents = totalAmountCents
    const { data: property } = await supabase
      .from('properties')
      .select('deposit_config, payment_processor, stripe_account_id')
      .eq('id', property_id)
      .single()

    if (property?.deposit_config) {
      const depositConfig = resolveDepositConfig(property.deposit_config as any, null).config
      if (
        depositConfig.require_deposit &&
        depositConfig.applies_to_booking_types.includes('nightly')
      ) {
        let depositAmountCents = 0
        switch (depositConfig.deposit_type) {
          case 'percentage':
            depositAmountCents = Math.round((totalAmountCents * (depositConfig.deposit_percentage || 0)) / 100)
            break
          case 'flat_amount':
            depositAmountCents = depositConfig.deposit_amount_cents || 0
            break
          case 'first_night': {
            // Derive nightly rate from total / nights
            const checkIn = new Date(typedReservation.check_in_date)
            const checkOut = new Date(typedReservation.check_out_date)
            const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)))
            depositAmountCents = Math.round(totalAmountCents / nights)
            break
          }
        }
        if (depositAmountCents > 0 && depositAmountCents < totalAmountCents) {
          amountInCents = depositAmountCents
          console.log('[Create Payment Intent] Deposit configured — charging deposit:', depositAmountCents, 'of', totalAmountCents)
        }
      }
    }

    console.log('[Create Payment Intent] Amount in cents:', amountInCents)

    // Resolve payment processor and create PaymentIntent via abstraction
    const processorType = resolvePaymentProcessor(property?.payment_processor)
    let processor: IPaymentProcessor
    try {
      processor = getProcessor(processorType, property?.stripe_account_id ?? undefined)
    } catch (procError: any) {
      return NextResponse.json(
        { error: procError.message || 'Payment processor not configured' },
        { status: 400 }
      )
    }

    const paymentIntentResult = await processor.createPaymentIntent({
      amountCents: amountInCents,
      currency: 'usd',
      automaticPaymentMethods: true,
      onBehalfOf: property?.stripe_account_id ?? undefined,
      transferDestination: property?.stripe_account_id ?? undefined,
      metadata: {
        reservation_id: reservation_id,
        property_id: property_id,
        confirmation_number: typedReservation.confirmation_number,
        guest_email: typedReservation.guest.email,
        guest_id: typedReservation.guest_id,
      },
      description: `Campsite reservation ${typedReservation.confirmation_number}`,
      receiptEmail: typedReservation.guest.email,
    })

    // Store PaymentIntent ID in reservation for reference
    await supabase
      .from('reservations')
      .update({
        // Store in notes for now - could add dedicated column
        notes: `${processorType} PaymentIntent: ${paymentIntentResult.paymentIntentId}`,
      })
      .eq('id', reservation_id)

    // Phase 3: Validate output
    const response = CreatePaymentIntentResponseSchema.parse({
      clientSecret: paymentIntentResult.clientSecret,
      paymentIntentId: paymentIntentResult.paymentIntentId,
    })

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error creating PaymentIntent:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
