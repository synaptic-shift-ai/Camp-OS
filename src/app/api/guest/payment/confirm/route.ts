/**
 * Payment Confirmation API (Public)
 *
 * POST /api/guest/payment/confirm
 *
 * Confirms payment and finalizes reservation.
 * This is a PUBLIC endpoint called after Stripe payment succeeds.
 *
 * Security:
 * - Verifies payment with Stripe
 * - Checks payment_intent status
 * - Updates reservation only if payment is valid
 *
 * Flow:
 * 1. Verify Stripe PaymentIntent
 * 2. Update reservation to 'confirmed'
 * 3. Update payment_status to 'paid'
 * 4. Create payment record
 * 5. Send confirmation email
 * 6. Return success
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sendBookingConfirmation } from '@/lib/email/send'
import { recordPaymentDualWrite } from '@/modules/Financial/application/recordPaymentDualWrite'
import { PaymentMethod } from '@/modules/Financial/domain/value-objects/PaymentMethod'
// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
})

// Input validation schema
const confirmPaymentSchema = z.object({
  payment_intent_id: z.string().startsWith('pi_', 'Invalid PaymentIntent ID'),
  reservation_id: z.string().uuid('Invalid reservation ID'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedInput = confirmPaymentSchema.parse(body)

    const supabase = await createClient()

    // ========================================================================
    // Step 1: Verify PaymentIntent with Stripe
    // ========================================================================

    let paymentIntent: Stripe.PaymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(validatedInput.payment_intent_id)
    } catch (stripeError) {
      console.error('[Payment Confirm] Stripe error:', stripeError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'STRIPE_ERROR', message: 'Could not verify payment with Stripe' }
        },
        { status: 500 }
      )
    }

    // Check payment status
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_NOT_COMPLETE',
            message: `Payment status is "${paymentIntent.status}". Expected "succeeded".`
          }
        },
        { status: 400 }
      )
    }

    // Verify payment amount matches (from metadata)
    const { reservation_id: metadataReservationId } = paymentIntent.metadata
    if (metadataReservationId !== validatedInput.reservation_id) {
      console.error('[Payment Confirm] Reservation ID mismatch', {
        expected: validatedInput.reservation_id,
        actual: metadataReservationId,
      })
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RESERVATION_MISMATCH', message: 'Payment does not match reservation' }
        },
        { status: 400 }
      )
    }

    // ========================================================================
    // Step 2: Get reservation details
    // ========================================================================

    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        *,
        guest:guests(*),
        site:sites(site_number, site_name),
        property:properties(name, email, phone, check_in_time, check_out_time, directions)
      `)
      .eq('id', validatedInput.reservation_id)
      .single()

    if (reservationError || !reservation) {
      console.error('[Payment Confirm] Reservation not found:', reservationError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found' }
        },
        { status: 404 }
      )
    }

    // Check if reservation is still pending
    if (reservation.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RESERVATION_NOT_PENDING',
            message: `Reservation is already ${reservation.status}`
          }
        },
        { status: 400 }
      )
    }

    // Verify payment amount matches reservation total
    const paidAmountCents = paymentIntent.amount
    if (paidAmountCents !== reservation.total_amount) {
      console.error('[Payment Confirm] Amount mismatch', {
        expected: reservation.total_amount,
        actual: paidAmountCents,
      })
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AMOUNT_MISMATCH',
            message: 'Payment amount does not match reservation total'
          }
        },
        { status: 400 }
      )
    }

    // ========================================================================
    // Step 3: Update reservation to confirmed
    // ========================================================================

    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'confirmed',
        payment_status: 'paid',
        paid_amount: paidAmountCents,
        reserved_until: null, // Clear checkout timer - payment completed
        notes: `Online payment via Stripe. PaymentIntent: ${validatedInput.payment_intent_id}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validatedInput.reservation_id)
      .eq('status', 'pending') // Ensure still pending (prevent race conditions)

    if (updateError) {
      console.error('[Payment Confirm] Reservation update error:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Could not update reservation status' }
        },
        { status: 500 }
      )
    }

    // ========================================================================
    // Step 3.5: Update site status to 'booked'
    // ========================================================================

    // const { error: siteUpdateError } = await supabase
    //   .from('sites')
    //   .update({
    //     status: 'booked',
    //     updated_at: new Date().toISOString(),
    //   })
    //   .eq('id', reservation.site_id)

    // if (siteUpdateError) {
    //   console.error('[Payment Confirm] Site status update error:', siteUpdateError)
    //   // Don't fail the payment confirmation - reservation is already confirmed
    //   // Site status can be manually corrected if needed
    // }

    // ========================================================================
    // Step 4: Create payment record
    // ========================================================================

    const { error: paymentRecordError } = await supabase
      .from('payments')
      .insert({
        property_id: reservation.property_id,
        reservation_id: reservation.id,
        amount: paidAmountCents,
        payment_method: 'credit_card',
        payment_status: 'completed',
        stripe_payment_id: validatedInput.payment_intent_id,
        processed_at: new Date().toISOString(),
        notes: `Stripe PaymentIntent: ${validatedInput.payment_intent_id}`,
      })

    if (paymentRecordError) {
      console.error('[Payment Confirm] Payment record creation error:', paymentRecordError)
      // Don't fail - reservation is already confirmed
    }

    // ========================================================================
    // Step 4.5: Dual-write to financial_transactions (best-effort)
    // ========================================================================

    try {
      const serviceRoleSupabase = createServiceRoleClient()
      await recordPaymentDualWrite({
        supabase: serviceRoleSupabase,
        propertyId: reservation.property_id,
        reservationId: reservation.id,
        guestId: reservation.guest_id,
        amountCents: paidAmountCents,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        stripePaymentIntentId: validatedInput.payment_intent_id,
        description: 'Guest self-service reservation payment',
        logPrefix: '[Payment Confirm DualWrite]',
      })
    } catch (dualWriteError) {
      console.error('[Payment Confirm] financial_transactions dual-write failed (non-blocking)', dualWriteError)
      // Don't fail - reservation is already confirmed and payment recorded
    }

    // ========================================================================
    // Step 5: Send confirmation email
    // ========================================================================

    const checkIn = new Date(reservation.check_in_date)
    const checkOut = new Date(reservation.check_out_date)
    const numNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    const emailData = {
      guestName: `${reservation.guest.first_name} ${reservation.guest.last_name}`,
      guestEmail: reservation.guest.email,
      confirmationNumber: reservation.confirmation_number,
      propertyName: reservation.property.name,
      siteName: reservation.site.site_name || `Site ${reservation.site.site_number}`,
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date,
      numNights,
      numAdults: reservation.num_adults,
      numChildren: reservation.num_children,
      totalAmount: reservation.total_amount,
      paidAmount: paidAmountCents,
      paymentStatus: 'paid' as const,
      specialRequests: reservation.special_requests || undefined,
      // Property contact and arrival info
      propertyPhone: reservation.property.phone || undefined,
      propertyEmail: reservation.property.email || undefined,
      checkInTime: reservation.property.check_in_time || undefined,
      checkOutTime: reservation.property.check_out_time || undefined,
      directions: reservation.property.directions || undefined,
    }

    const emailResult = await sendBookingConfirmation(emailData)

    if (!emailResult.success) {
      console.error('[Payment Confirm] Email send failed:', emailResult.error)
      // Don't fail - reservation is confirmed
    }

    // ========================================================================
    // Step 6: Return success
    // ========================================================================

    return NextResponse.json({
      success: true,
      data: {
        reservation_id: reservation.id,
        confirmation_number: reservation.confirmation_number,
        status: 'confirmed',
        payment_status: 'paid',
        guest_name: `${reservation.guest.first_name} ${reservation.guest.last_name}`,
        guest_email: reservation.guest.email,
        property_name: reservation.property.name,
        site_name: reservation.site.site_name || `Site ${reservation.site.site_number}`,
        check_in_date: reservation.check_in_date,
        check_out_date: reservation.check_out_date,
        total_amount_cents: reservation.total_amount,
        paid_amount_cents: paidAmountCents,
        email_sent: emailResult.success,
      },
      message: 'Payment confirmed successfully. Confirmation email sent.',
    })
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    // Handle unexpected errors
    console.error('[Payment Confirm] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
