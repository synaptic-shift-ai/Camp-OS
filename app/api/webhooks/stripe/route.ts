/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for payment processing.
 * Primary event: payment_intent.succeeded
 *
 * Flow:
 * 1. Verify webhook signature (security)
 * 2. Parse and validate event data
 * 3. Update reservation status to confirmed
 * 4. Update payment_status to paid
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { StripePaymentIntentSucceededSchema } from '@/contracts/schemas'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
})

// Webhook secret for signature verification
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      // Phase 3: Validate event data with Zod
      const validationResult = StripePaymentIntentSucceededSchema.safeParse(paymentIntent)

      if (!validationResult.success) {
        console.error('Invalid payment intent data:', validationResult.error.format())
        // Still return 200 to acknowledge receipt (Stripe will retry otherwise)
        return NextResponse.json({
          received: true,
          warning: 'Invalid event data format'
        })
      }

      const validated = validationResult.data
      const { reservation_id, property_id } = validated.metadata

      const supabase = createServiceRoleClient()

      // Update reservation status
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          paid_amount: validated.amount, // Amount in cents (BIGINT)
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservation_id)
        .eq('property_id', property_id) // Tenant isolation

      if (updateError) {
        console.error('Failed to update reservation:', updateError)
        // Still return 200 to prevent retries for DB errors
        return NextResponse.json({
          received: true,
          warning: 'Database update failed',
        })
      }

      console.log(`Reservation ${reservation_id} confirmed via webhook`)
    }

    // Acknowledge receipt of event
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    // Return 500 for unexpected errors (Stripe will retry)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
