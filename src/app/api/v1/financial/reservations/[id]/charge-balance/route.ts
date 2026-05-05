/**
 * Off-Session Balance Charge
 *
 * POST /api/v1/financial/reservations/[id]/charge-balance
 *
 * Charges the outstanding balance using a card stored on file.
 * Operator-initiated — requires staff auth with financial.record_payment permission.
 *
 * Flow:
 * 1. Auth + RBAC check (staff, financial.record_payment)
 * 2. Idempotency check — skip if a recent balance charge exists (last 60s)
 * 3. Fetch reservation + property config
 * 4. Compute outstanding balance from financial_transactions
 * 5. Look up guest's stored payment method
 * 6. Create off-session PaymentIntent via IPaymentProcessor (confirm=true)
 * 7. Only record CHARGE + PAYMENT when PaymentIntent status is 'succeeded'
 * 8. Update reservation paid_amount / payment_status
 */

import { type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { resolvePaymentProcessor } from '@/lib/config/resolution'
import { getProcessor } from '@/modules/Financial/infrastructure/ProcessorFactory'
import type { IPaymentProcessor } from '@/modules/Financial/infrastructure/IPaymentProcessor'
import { Transaction } from '@/modules/Financial/domain/Transaction'
import { TransactionType } from '@/modules/Financial/domain/value-objects/TransactionType'
import { TransactionSource } from '@/modules/Financial/domain/value-objects/TransactionSource'
import { PaymentMethod } from '@/modules/Financial/domain/value-objects/PaymentMethod'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'

/**
 * POST /api/v1/financial/reservations/[id]/charge-balance
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
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id, guest_id, total_amount, paid_amount, status, payment_status')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found')
    }

    // RBAC: require financial.record_payment permission
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.property_id,
      minimumRole: 'staff',
      permission: 'financial.record_payment',
    })
    if (isDenied(access)) return access

    // Compute outstanding balance from ledger
    const serviceRole = createServiceRoleClient()
    const { data: transactions, error: txnError } = await serviceRole
      .from('financial_transactions')
      .select('type, amount_cents')
      .eq('reservation_id', reservationId)
      .neq('is_voided', true)
      .eq('status', 'completed')

    if (txnError) {
      console.error('[Charge Balance] Balance query error:', txnError)
      return error(ErrorCodes.INTERNAL_ERROR, 'Failed to query transactions', { message: txnError.message })
    }

    let chargesTotal = 0
    let paymentsTotal = 0
    let refundsTotal = 0

    for (const txn of transactions ?? []) {
      if (txn.type === 'charge') chargesTotal += txn.amount_cents
      else if (txn.type === 'payment') paymentsTotal += txn.amount_cents
      else if (txn.type === 'refund') refundsTotal += txn.amount_cents
    }

    const balance = chargesTotal - paymentsTotal - refundsTotal

    if (balance <= 0) {
      return error(ErrorCodes.VALIDATION_ERROR, 'No outstanding balance')
    }

    // ── C1: Idempotency check ──────────────────────────────────────────────
    // Check if a balance charge was already recorded in the last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()
    const { data: recentCharge } = await serviceRole
      .from('financial_transactions')
      .select('id, amount_cents, processor_event_id, created_at')
      .eq('reservation_id', reservationId)
      .eq('type', 'charge')
      .eq('source', 'system')
      .ilike('notes', '%balance charge%')
      .gte('created_at', sixtySecondsAgo)
      .limit(1)
      .single()

    if (recentCharge) {
      console.log('[Charge Balance] Idempotent — returning existing charge', {
        id: recentCharge.id,
        amount: recentCharge.amount_cents,
      })
      return success({
        idempotent: true,
        transaction_id: recentCharge.id,
        payment_intent_id: recentCharge.processor_event_id,
        amount_charged: recentCharge.amount_cents,
      })
    }

    // Get property config for processor + stripe_account_id
    const { data: property } = await supabase
      .from('properties')
      .select('payment_processor, stripe_account_id')
      .eq('id', reservation.property_id)
      .single()

    // Resolve payment processor
    const processorType = resolvePaymentProcessor(property?.payment_processor)
    let processor: IPaymentProcessor
    try {
      processor = getProcessor(processorType, property?.stripe_account_id ?? undefined)
    } catch (procErr: unknown) {
      const msg = procErr instanceof Error ? procErr.message : 'Payment processor not configured'
      return error(ErrorCodes.VALIDATION_ERROR, msg)
    }

    // Look up guest's stored payment method
    const { data: guest } = await supabase
      .from('guests')
      .select('id, stripe_customer_id')
      .eq('id', reservation.guest_id)
      .eq('property_id', reservation.property_id)
      .single()

    if (!guest?.stripe_customer_id) {
      return error(ErrorCodes.VALIDATION_ERROR, 'No card on file for this guest')
    }

    // Find the most recent payment method from the processor
    const paymentMethods = await processor.listPaymentMethods(guest.stripe_customer_id)
    if (!paymentMethods.length) {
      return error(ErrorCodes.VALIDATION_ERROR, 'No card on file for this guest')
    }

    // Use the most recently added payment method
    const paymentMethod = paymentMethods[0]
    if (paymentMethod === undefined) {
      return error(ErrorCodes.VALIDATION_ERROR, 'No card on file for this guest')
    }

    // ── C2: Create off-session, confirmed PaymentIntent ────────────────────
    // Generate Stripe Idempotency-Key: reservation_id + balance rounded to minute
    const idempotencyKey = `balance-${reservationId}-${balance}-${Math.floor(Date.now() / 60_000)}`

    const paymentIntent = await processor.createPaymentIntent({
      amountCents: balance,
      currency: 'usd',
      customerId: guest.stripe_customer_id,
      paymentMethod: paymentMethod.id,
      confirm: true,
      offSession: true,
      metadata: {
        reservation_id: reservationId,
        property_id: reservation.property_id,
        guest_id: guest.id,
        source: 'balance_charge',
        idempotency_key: idempotencyKey,
      },
      description: `Balance charge for reservation ${reservationId}`,
    })

    // ── C2: Only record transactions when PaymentIntent succeeded ─────────
    if (paymentIntent.status === 'succeeded') {
      const repo = new SupabaseTransactionRepository(serviceRole)

      const charge = Transaction.create(
        randomUUID(),
        reservation.property_id,
        reservationId,
        TransactionType.CHARGE,
        MoneyAmount.create(balance),
        PaymentMethod.STRIPE,
        user.id,
        null,
        'Balance charge (off-session)',
        TransactionSource.SYSTEM,
        paymentIntent.paymentIntentId,
        guest.id,
      )
      charge.complete(paymentIntent.paymentIntentId)
      await repo.save(charge)

      const payment = Transaction.create(
        randomUUID(),
        reservation.property_id,
        reservationId,
        TransactionType.PAYMENT,
        MoneyAmount.create(balance),
        PaymentMethod.STRIPE,
        user.id,
        null,
        'Balance payment (off-session)',
        TransactionSource.SYSTEM,
        paymentIntent.paymentIntentId,
        guest.id,
      )
      payment.complete(paymentIntent.paymentIntentId)
      await repo.save(payment)

      // Update reservation snapshot amounts
      const previousPaid = (reservation.paid_amount as number) ?? 0
      const nextPaid = previousPaid + balance
      const totalAmount = (reservation.total_amount as number) ?? 0
      const nextPaymentStatus =
        nextPaid >= totalAmount ? 'paid' : nextPaid > 0 ? 'partial' : 'pending'

      const reservationUpdate: Record<string, unknown> = {
        paid_amount: nextPaid,
        payment_status: nextPaymentStatus,
        updated_at: new Date().toISOString(),
      }

      if (reservation.status === 'pending' && nextPaid >= totalAmount) {
        reservationUpdate.status = 'confirmed'
      }

      const { error: reservationUpdateError } = await serviceRole
        .from('reservations')
        .update(reservationUpdate)
        .eq('id', reservationId)
        .eq('property_id', reservation.property_id)

      if (reservationUpdateError) {
        console.error('[Charge Balance] Reservation update failed (non-blocking)', {
          reservationId,
          error: reservationUpdateError,
        })
      }

      return success({
        idempotent: false,
        payment_intent_id: paymentIntent.paymentIntentId,
        status: paymentIntent.status,
        amount_charged: balance,
        payment_method: paymentMethod.card
          ? `${paymentMethod.card.brand} •••• ${paymentMethod.card.last4}`
          : paymentMethod.type,
      })
    }

    if (paymentIntent.status === 'requires_payment_method') {
      return error(
        ErrorCodes.VALIDATION_ERROR,
        'Card on file is no longer valid. Please update the payment method.',
      )
    }

    if (paymentIntent.status === 'requires_action') {
      return error(
        ErrorCodes.VALIDATION_ERROR,
        'Additional authentication required (3D Secure). Forward the client_secret to the guest.',
        { client_secret: paymentIntent.clientSecret, payment_intent_id: paymentIntent.paymentIntentId },
      )
    }

    if (paymentIntent.status === 'processing') {
      // Payment is in flight — the webhook will handle confirmation
      return success({
        idempotent: false,
        payment_intent_id: paymentIntent.paymentIntentId,
        status: paymentIntent.status,
        amount_charged: balance,
        note: 'Payment is processing. The webhook will confirm and record the transaction.',
      })
    }

    if (paymentIntent.status === 'canceled') {
      return error(ErrorCodes.VALIDATION_ERROR, 'Payment was canceled.')
    }

    // Catch-all for unexpected statuses
    return error(
      ErrorCodes.INTERNAL_ERROR,
      `Unexpected PaymentIntent status: ${paymentIntent.status}`,
      { payment_intent_id: paymentIntent.paymentIntentId, status: paymentIntent.status },
    )
  } catch (err: unknown) {
    console.error('[Charge Balance] Error:', err)
    const message = err instanceof Error ? err.message : 'Failed to charge balance'
    return error(ErrorCodes.INTERNAL_ERROR, 'Failed to charge balance', { message })
  }
}
