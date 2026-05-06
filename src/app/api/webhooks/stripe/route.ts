/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for payment processing.
 *
 * Supported events:
 * - payment_intent.succeeded  — Confirm reservation, create ledger records
 * - payment_intent.payment_failed — Mark reservation payment as failed
 * - charge.refunded             — Create refund record in financial_transactions
 * - setup_intent.succeeded       — Log confirmed card-on-file
 * - setup_intent.failed          — Log failed card setup
 *
 * Flow:
 * 1. Verify webhook signature (security)
 * 2. Route event to the appropriate handler
 * 3. Handlers are idempotent (processor_event_id dedup)
 * 4. Always return 200 to acknowledge receipt (Stripe retries on non-200)
 */

import { type NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { StripePaymentIntentSucceededSchema } from '@/contracts/schemas'
import { getTenantStripeClient, createTenantRequestOptions } from '@/lib/stripe/tenant-client'
import type { Guest } from '@/lib/booking/types'
import { ReservationConfirmed } from '@/modules/BookingEngine/domain/events/ReservationConfirmed'
import { PaymentReceived } from '@/modules/BookingEngine/domain/events/PaymentReceived'
import { Transaction } from '@/modules/Financial/domain/Transaction'
import { TransactionType } from '@/modules/Financial/domain/value-objects/TransactionType'
import { TransactionSource } from '@/modules/Financial/domain/value-objects/TransactionSource'
import { PaymentMethod } from '@/modules/Financial/domain/value-objects/PaymentMethod'
import { RecognitionStatus } from '@/modules/Financial/domain/value-objects/RecognitionStatus'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { randomUUID } from 'crypto'

// Initialize platform Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
})

// Webhook secret for signature verification
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * Dual-write to financial_transactions alongside legacy payments.
 * Best-effort: failures are logged but never block the webhook response.
 */
async function writeFinancialTransactions(params: {
  supabase: ReturnType<typeof createServiceRoleClient>
  /** Stripe event id (evt_...) — logging only */
  stripeEventId: string
  propertyId: string
  reservationId: string
  guestId: string
  amountCents: number
  stripePaymentIntentId: string
  /** When set and less than amountCents, this is a deposit payment */
  reservationTotalCents?: number
}): Promise<void> {
  const {
    supabase,
    stripeEventId,
    propertyId,
    reservationId,
    guestId,
    amountCents,
    stripePaymentIntentId,
    reservationTotalCents,
  } = params

  const isDepositPayment = reservationTotalCents != null && amountCents < reservationTotalCents

  try {
    const repo = new SupabaseTransactionRepository(supabase as any)
    const amount = MoneyAmount.create(amountCents)

    // Guest checkout: do not attribute ledger rows to property staff (reservations.created_by).
    const createdByUserId: string | null = null
    // Dedupe with guest `/api/guest/payment/confirm` dual-write (same PaymentIntent id).
    const processorKey = stripePaymentIntentId
    const existingPayment = await repo.findByProcessorEventId(processorKey, TransactionType.PAYMENT)
    if (existingPayment) {
      console.log('[Stripe Webhook] financial_transactions dual-write skipped (already exists)', {
        stripeEventId,
        stripePaymentIntentId,
      })
      return
    }

    // Create PAYMENT record (guest checkout should show as "Payment" in transaction history)
    const paymentId = randomUUID()
    const payment = Transaction.create(
      paymentId,
      propertyId,
      reservationId,
      TransactionType.PAYMENT,
      amount,
      PaymentMethod.STRIPE,
      createdByUserId,
      null, // invoiceId
      isDepositPayment
        ? 'Guest self-service reservation payment (deposit)'
        : 'Guest self-service reservation payment',
      TransactionSource.RESERVATION,
      processorKey,
      guestId,
    )
    payment.complete(stripePaymentIntentId)
    await repo.save(payment)
    console.log(`[Stripe Webhook] financial_transactions PAYMENT created: ${paymentId}`)
  } catch (ftError: any) {
    // Best-effort: log but don't fail the webhook
    const isConstraintViolation =
      ftError?.message?.includes('duplicate key') ||
      ftError?.message?.includes('unique constraint') ||
      ftError?.message?.includes('23505')
    if (isConstraintViolation) {
      console.warn('[Stripe Webhook] financial_transactions dual-write skipped (race condition, already exists)', {
        stripeEventId,
        stripePaymentIntentId,
        error: ftError.message,
      })
    } else {
      console.error('[Stripe Webhook] financial_transactions dual-write failed (non-blocking)', {
        stripeEventId,
        stripePaymentIntentId,
        error: ftError,
      })
    }
  }
}

/**
 * Handle successful payment intent
 *
 * This function:
 * 1. Retrieves the reservation and guest from metadata
 * 2. Checks if guest already has a Stripe Customer
 * 3. If not, creates a Stripe Customer on the tenant's account
 * 4. Retrieves the PaymentMethod from the PaymentIntent
 * 5. Attaches the PaymentMethod to the Customer
 * 6. Saves stripe_customer_id to the guest record
 * 7. Updates reservation: status='confirmed', payment_status='paid', paid_amount=total_amount
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, stripeEventId: string): Promise<void> {
  // Phase 3: Validate event data with Zod
  const validationResult = StripePaymentIntentSucceededSchema.safeParse(paymentIntent)

  if (!validationResult.success) {
    console.error('Invalid payment intent data:', validationResult.error.format())
    // Log error but don't throw - return to acknowledge receipt
    return
  }

  const validated = validationResult.data
  const { reservation_id, property_id, guest_id } = validated.metadata

  if (!guest_id) {
    console.error('Missing guest_id in PaymentIntent metadata:', validated.metadata)
    return
  }

  const supabase = createServiceRoleClient()

  // Get tenant Stripe client
  const tenantStripeResult = await getTenantStripeClient(property_id)
  if (!tenantStripeResult.success) {
    console.error('Failed to get tenant Stripe client:', tenantStripeResult.error)
    return
  }

  const { stripe: tenantStripe, stripeAccountId } = tenantStripeResult
  const _stripeOptions = createTenantRequestOptions(stripeAccountId)

  try {
    // Fetch guest record
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('*')
      .eq('id', guest_id)
      .eq('property_id', property_id) // Tenant isolation
      .single()

    if (guestError || !guest) {
      console.error('Guest not found:', guestError)
      return
    }

    const typedGuest = guest as Guest

    // For destination charges, Customer and PaymentMethod are on PLATFORM account
    // We create/retrieve customer on platform and store that ID for future "Card on File" use
    const platformStripe = tenantStripe // This is the platform Stripe client

    let stripeCustomerId = typedGuest.stripe_customer_id

    // Create Stripe Customer on PLATFORM account if doesn't exist
    if (!stripeCustomerId) {
      console.log(`Creating Stripe Customer on platform account for guest ${guest_id}`)

      const customer = await platformStripe.customers.create({
        email: typedGuest.email,
        name: `${typedGuest.first_name} ${typedGuest.last_name}`,
        ...(typedGuest.phone && { phone: typedGuest.phone }),
        metadata: {
          guest_id: typedGuest.id,
          property_id: property_id,
        },
      })

      stripeCustomerId = customer.id

      // Save stripe_customer_id to guest record
      // Note: This will fail if column doesn't exist - user needs to run migration
      const { error: updateGuestError } = await supabase
        .from('guests')
        .update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guest_id)
        .eq('property_id', property_id)

      if (updateGuestError) {
        console.error('Failed to update guest with stripe_customer_id:', updateGuestError)
        console.error('Run this SQL in Supabase: ALTER TABLE guests ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;')
        // Continue processing - customer was created, just not saved to DB
      } else {
        console.log(`Saved stripe_customer_id ${stripeCustomerId} to guest ${guest_id}`)
      }
    }

    // Attach PaymentMethod to Customer on PLATFORM account
    const paymentMethodId = validated.payment_method
    if (paymentMethodId && typeof paymentMethodId === 'string') {
      console.log(`Attaching PaymentMethod ${paymentMethodId} to Customer ${stripeCustomerId}`)

      try {
        await platformStripe.paymentMethods.attach(
          paymentMethodId,
          { customer: stripeCustomerId },
        )

        // Set as default payment method
        await platformStripe.customers.update(
          stripeCustomerId,
          {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          },
        )

        console.log(`PaymentMethod ${paymentMethodId} attached and set as default`)
      } catch (pmError: any) {
        console.error('Failed to attach PaymentMethod:', pmError.message)
        // Continue processing - payment succeeded, just couldn't save card
      }
    } else {
      console.warn('No payment_method found on PaymentIntent - cannot save card')
    }

    // Update reservation status to confirmed and paid (deposit-aware)
    // Fetch reservation to compare PaymentIntent amount vs total
    const { data: reservationRow } = await supabase
      .from('reservations')
      .select('total_amount')
      .eq('id', reservation_id)
      .eq('property_id', property_id)
      .single()

    const reservationTotal = (reservationRow?.total_amount ?? validated.amount) as number
    const isDepositPayment = validated.amount < reservationTotal

    const { error: updateReservationError } = await supabase
      .from('reservations')
      .update({
        status: 'confirmed',
        payment_status: isDepositPayment ? 'deposit_paid' : 'paid',
        paid_amount: validated.amount, // Amount in cents (BIGINT)
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservation_id)
      .eq('property_id', property_id) // Tenant isolation

    if (updateReservationError) {
      console.error('Failed to update reservation:', updateReservationError)
      // Don't throw - payment succeeded, customer created, just DB update failed
    } else {
      console.log(`Reservation ${reservation_id} confirmed via webhook (amount: $${validated.amount / 100}${isDepositPayment ? ', deposit payment' : ''})`)
    }

    // --- Dual-write to financial_transactions (unified ledger) ---
    await writeFinancialTransactions({
      supabase,
      stripeEventId,
      propertyId: property_id,
      reservationId: reservation_id,
      guestId: guest_id,
      amountCents: validated.amount,
      stripePaymentIntentId: validated.id,
      reservationTotalCents: reservationTotal,
    })

    // --- Publish domain events (fire-and-forget with timeout) ---
    // Fetch confirmation_number for event payload
    const { data: confirmedReservation } = await supabase
      .from('reservations')
      .select('confirmation_number')
      .eq('id', reservation_id)
      .eq('property_id', property_id)
      .single()

    const confirmationNumber = (confirmedReservation as any)?.confirmation_number ?? ''

    const events = [
      new ReservationConfirmed(reservation_id, confirmationNumber),
      new PaymentReceived(
        reservation_id,
        confirmationNumber,
        validated.amount,
        'card',
        validated.id,
      ),
    ]

    // Fire-and-forget — events are no longer published via EventBus.
    // Domain event objects are kept for potential future use.
    void events
  } catch (error: any) {
    console.error('Error in handlePaymentIntentSucceeded:', error)
    // Don't throw - webhook already received, just log the error
  }
}

/**
 * Handle failed payment intent
 *
 * Updates the reservation's payment_status to 'payment_failed' so the
 * guest can retry. No financial_transactions records are created (no money moved).
 */
async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  stripeEventId: string,
): Promise<void> {
  const { reservation_id, property_id } = (paymentIntent.metadata ?? {}) as Record<string, string>

  if (!reservation_id || !property_id) {
    console.warn('[Stripe Webhook] payment_intent.payment_failed: missing reservation_id or property_id in metadata', {
      stripeEventId,
    })
    return
  }

  const lastError = paymentIntent.last_payment_error
  const failureMessage = lastError?.message ?? 'Unknown failure'
  const declineCode = (lastError as any)?.decline_code ?? null

  console.error('[Stripe Webhook] payment_intent.payment_failed', {
    stripeEventId,
    reservation_id,
    property_id,
    failureMessage,
    declineCode,
  })

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('reservations')
    .update({
      payment_status: 'payment_failed',
      notes: `Payment failed: ${failureMessage}${declineCode ? ` (${declineCode})` : ''}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservation_id)
    .eq('property_id', property_id)
    .eq('status', 'pending') // Only update if still pending (don't overwrite confirmed)

  if (error) {
    console.error('[Stripe Webhook] Failed to update reservation on payment_intent.payment_failed:', error)
  }
}

/**
 * Handle charge.refunded event
 *
 * Creates a REFUND record in financial_transactions.
 * Idempotent: skips if a record with processor_event_id already exists.
 */
async function handleChargeRefunded(charge: Stripe.Charge, stripeEventId: string): Promise<void> {
  const { reservation_id, property_id, guest_id } = (charge.metadata ?? {}) as Record<string, string>

  if (!reservation_id || !property_id) {
    console.warn('[Stripe Webhook] charge.refunded: missing reservation_id or property_id in charge metadata', {
      stripeEventId,
    })
    return
  }

  const refundAmountCents = charge.amount_refunded
  if (!refundAmountCents || refundAmountCents <= 0) {
    console.warn('[Stripe Webhook] charge.refunded: amount_refunded is 0 or missing, skipping', {
      stripeEventId,
      chargeId: charge.id,
    })
    return
  }

  const supabase = createServiceRoleClient()

  try {
    const repo = new SupabaseTransactionRepository(supabase as any)

    // Idempotency: skip if already processed
    const existing = await repo.findByProcessorEventId(stripeEventId, TransactionType.REFUND)
    if (existing) {
      console.log('[Stripe Webhook] charge.refunded: already processed (idempotent)', { stripeEventId })
      return
    }

    const amount = MoneyAmount.create(refundAmountCents)
    const refundId = randomUUID()
    const refundReason = charge.refunds?.data?.[0]?.reason

    const refund = Transaction.create(
      refundId,
      property_id,
      reservation_id,
      TransactionType.REFUND,
      amount,
      PaymentMethod.STRIPE,
      null, // createdBy — system-initiated via Stripe
      null, // invoiceId
      `Stripe refund${refundReason ? ` (${refundReason})` : ''}`,
      TransactionSource.RESERVATION,
      stripeEventId,
      guest_id ?? null,
    )
    refund.complete(charge.payment_intent as string | null)

    await repo.save(refund)
    console.log(`[Stripe Webhook] financial_transactions REFUND created: ${refundId}`, {
      stripeEventId,
      amountCents: refundAmountCents,
      reservation_id,
    })
  } catch (ftError: any) {
    const isConstraintViolation =
      ftError?.message?.includes('duplicate key') ||
      ftError?.message?.includes('unique constraint') ||
      ftError?.message?.includes('23505')
    if (isConstraintViolation) {
      console.warn('[Stripe Webhook] charge.refunded: skipped (race condition, already exists)', {
        stripeEventId,
        error: ftError.message,
      })
    } else {
      console.error('[Stripe Webhook] charge.refunded: failed to create refund record (non-blocking)', {
        stripeEventId,
        error: ftError,
      })
    }
  }
}

/**
 * Handle setup_intent.succeeded event
 *
 * Confirms that a payment method has been successfully saved for a guest.
 * The PaymentIntent.succeeded handler already attaches the PM to the customer;
 * this handler is an additional confirmation for card-on-file flows.
 */
async function handleSetupIntentSucceeded(
  setupIntent: Stripe.SetupIntent,
  stripeEventId: string,
): Promise<void> {
  const { guest_id } = (setupIntent.metadata ?? {}) as Record<string, string>

  if (!guest_id) {
    console.warn('[Stripe Webhook] setup_intent.succeeded: missing guest_id in metadata', { stripeEventId })
    return
  }

  console.log('[Stripe Webhook] setup_intent.succeeded: card-on-file confirmed for guest', {
    stripeEventId,
    guest_id,
    setupIntentId: setupIntent.id,
  })
}

/**
 * Handle setup_intent.failed event
 *
 * Logs the failure for monitoring. No action needed — the guest can retry.
 */
async function handleSetupIntentFailed(
  setupIntent: Stripe.SetupIntent,
  stripeEventId: string,
): Promise<void> {
  const { guest_id } = (setupIntent.metadata ?? {}) as Record<string, string>

  const lastError = setupIntent.last_setup_error
  const failureMessage = lastError?.message ?? 'Unknown failure'

  console.error('[Stripe Webhook] setup_intent.failed', {
    stripeEventId,
    guest_id,
    setupIntentId: setupIntent.id,
    failureMessage,
  })
}

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

    // Route event to the appropriate handler
    // `setup_intent.failed` is valid at runtime but may be missing from SDK `Event.type` union
    const eventType = event.type as string
    if (eventType === 'setup_intent.failed') {
      await handleSetupIntentFailed(event.data.object as Stripe.SetupIntent, event.id)
    } else {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, event.id)
          break

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, event.id)
          break

        case 'charge.refunded':
          await handleChargeRefunded(event.data.object as Stripe.Charge, event.id)
          break

        case 'setup_intent.succeeded':
          await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent, event.id)
          break

        default:
          // Acknowledge unhandled events without processing
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`, { eventId: event.id })
          break
      }
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
