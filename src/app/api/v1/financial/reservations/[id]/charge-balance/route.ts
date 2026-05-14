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
import { z } from 'zod'
import { summarizeReservationFinancialTransactions } from '@/lib/financial/reservation-amount-due'

const BodySchema = z.object({
  payment_method_id: z.string().optional(),
  /** When set, charge this many cents (must be ≤ computed amount due). Defaults to full amount due. */
  amount_cents: z.number().int().positive().optional(),
})

const VAL = ErrorCodes.VALIDATION_ERROR
const RES404 = ErrorCodes.RESOURCE_NOT_FOUND
const AUTH = ErrorCodes.AUTH_001
const INT = ErrorCodes.INTERNAL_ERROR

function logChargeBalance(reason: string, data: Record<string, unknown>) {
  console.warn('[Charge Balance]', { reason, ...data })
}

function stripeFailureFields(err: unknown): Record<string, string | undefined> | null {
  if (!err || typeof err !== 'object') return null
  const e = err as Record<string, unknown>
  if (typeof e.type !== 'string') return null
  return {
    stripe_type: e.type,
    stripe_code: typeof e.code === 'string' ? e.code : undefined,
    decline_code: typeof e.decline_code === 'string' ? e.decline_code : undefined,
    stripe_message: typeof e.message === 'string' ? e.message : undefined,
  }
}

/**
 * POST /api/v1/financial/reservations/[id]/charge-balance
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let reservationId: string | undefined
  try {
    reservationId = (await params).id
    const supabase = await createClient()
    const body = BodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) {
      logChargeBalance('request_body_invalid', {
        reservationId,
        issues: body.error.issues,
      })
      return error(VAL.code, 'Invalid request body', VAL.status, request, {
        issues: body.error.flatten(),
      })
    }
    const requestedPaymentMethodId =
      typeof body.data.payment_method_id === 'string' && body.data.payment_method_id.length > 0
        ? body.data.payment_method_id
        : null

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      logChargeBalance('unauthorized', { reservationId, authError: authError?.message })
      return error(AUTH.code, 'Unauthorized', AUTH.status, request)
    }

    // Fetch reservation
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id, guest_id, total_amount, paid_amount, status, payment_status')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      logChargeBalance('reservation_not_found', {
        reservationId,
        dbMessage: reservationError?.message,
      })
      return error(RES404.code, 'Reservation not found', RES404.status, request)
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
      .select('type, amount_cents, source, handling')
      .eq('reservation_id', reservationId)
      .neq('is_voided', true)
      .eq('status', 'completed')

    if (txnError) {
      logChargeBalance('ledger_query_failed', {
        reservationId,
        message: txnError.message,
      })
      return error(INT.code, 'Failed to query transactions', INT.status, request, {
        message: txnError.message,
      })
    }

    const reservationTotalAmount = (reservation.total_amount as number | null) ?? 0
    const reservationPaidAmount = (reservation.paid_amount as number | null) ?? 0
    const sums = summarizeReservationFinancialTransactions(
      transactions ?? [],
      reservationTotalAmount,
      reservationPaidAmount,
    )
    const {
      chargesTotal,
      paymentsTotal,
      refundsTotal,
      ledgerBalance,
      reservationBalance,
      balanceDueCents: maxDueCents,
    } = sums

    if (maxDueCents <= 0) {
      logChargeBalance('no_outstanding_balance', {
        reservationId,
        chargesTotal,
        paymentsTotal,
        refundsTotal,
        ledgerBalance,
        reservationTotalAmount,
        reservationPaidAmount,
        reservationBalance,
        balance: maxDueCents,
      })
      return error(VAL.code, 'No outstanding balance', VAL.status, request)
    }

    const requestedAmountCents = body.data.amount_cents
    let chargeCents = maxDueCents
    if (requestedAmountCents !== undefined) {
      if (requestedAmountCents > maxDueCents || requestedAmountCents < 1) {
        logChargeBalance('amount_cents_out_of_range', {
          reservationId,
          requestedAmountCents,
          maxDueCents,
        })
        return error(
          VAL.code,
          `amount_cents must be between 1 and ${maxDueCents} (current amount due in cents)`,
          VAL.status,
          request,
          { max_due_cents: maxDueCents, requested_cents: requestedAmountCents },
        )
      }
      chargeCents = requestedAmountCents
    }

    // ── C1: Idempotency check ──────────────────────────────────────────────
    // Check if a balance charge was already recorded in the last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()
    const { data: recentCharge } = await serviceRole
      .from('financial_transactions')
      .select('id, amount_cents, processor_event_id, created_at')
      .eq('reservation_id', reservationId)
      .eq('type', 'charge')
      .eq('amount_cents', chargeCents)
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
      logChargeBalance('processor_unavailable', {
        reservationId,
        processorType,
        message: msg,
      })
      return error(VAL.code, msg, VAL.status, request)
    }

    // Look up guest's stored payment method
    const { data: guest } = await supabase
      .from('guests')
      .select('id, stripe_customer_id')
      .eq('id', reservation.guest_id)
      .eq('property_id', reservation.property_id)
      .single()

    if (!guest?.stripe_customer_id) {
      logChargeBalance('guest_missing_stripe_customer', {
        reservationId,
        guestId: reservation.guest_id,
        propertyId: reservation.property_id,
      })
      return error(VAL.code, 'No card on file for this guest', VAL.status, request)
    }

    // Find the most recent payment method from the processor
    const paymentMethods = await processor.listPaymentMethods(guest.stripe_customer_id)
    if (!paymentMethods.length) {
      logChargeBalance('no_saved_payment_methods', {
        reservationId,
        guestId: guest.id,
        stripeCustomerIdPrefix: `${guest.stripe_customer_id.slice(0, 8)}…`,
      })
      return error(VAL.code, 'No card on file for this guest', VAL.status, request)
    }

    const paymentMethod =
      requestedPaymentMethodId != null
        ? paymentMethods.find((pm) => pm.id === requestedPaymentMethodId)
        : paymentMethods[0]
    if (paymentMethod === undefined) {
      logChargeBalance('selected_payment_method_not_found', {
        reservationId,
        requestedPaymentMethodId,
        availableMethodIds: paymentMethods.map((pm) => pm.id),
      })
      return error(VAL.code, 'Selected card is not available for this guest', VAL.status, request)
    }

    // ── C2: Create off-session, confirmed PaymentIntent ────────────────────
    // Generate Stripe Idempotency-Key: reservation_id + charge amount rounded to minute
    const idempotencyKey = `balance-${reservationId}-${chargeCents}-${Math.floor(Date.now() / 60_000)}`

    const paymentIntent = await processor.createPaymentIntent({
      amountCents: chargeCents,
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
        MoneyAmount.create(chargeCents),
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
        MoneyAmount.create(chargeCents),
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
      const nextPaid = previousPaid + chargeCents
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
        amount_charged: chargeCents,
        payment_method: paymentMethod.card
          ? `${paymentMethod.card.brand} •••• ${paymentMethod.card.last4}`
          : paymentMethod.type,
      })
    }

    if (paymentIntent.status === 'requires_payment_method') {
      logChargeBalance('payment_intent_requires_payment_method', {
        reservationId,
        paymentIntentId: paymentIntent.paymentIntentId,
        status: paymentIntent.status,
        chargeCents,
      })
      return error(
        VAL.code,
        'Card on file is no longer valid. Please update the payment method.',
        VAL.status,
        request,
        { payment_intent_id: paymentIntent.paymentIntentId },
      )
    }

    if (paymentIntent.status === 'requires_action') {
      logChargeBalance('payment_intent_requires_action', {
        reservationId,
        paymentIntentId: paymentIntent.paymentIntentId,
        status: paymentIntent.status,
        chargeCents,
      })
      return error(
        VAL.code,
        'Additional authentication required (3D Secure). Forward the client_secret to the guest.',
        VAL.status,
        request,
        {
          client_secret: paymentIntent.clientSecret,
          payment_intent_id: paymentIntent.paymentIntentId,
        },
      )
    }

    if (paymentIntent.status === 'processing') {
      // Payment is in flight — the webhook will handle confirmation
      return success({
        idempotent: false,
        payment_intent_id: paymentIntent.paymentIntentId,
        status: paymentIntent.status,
        amount_charged: chargeCents,
        note: 'Payment is processing. The webhook will confirm and record the transaction.',
      })
    }

    if (paymentIntent.status === 'canceled') {
      logChargeBalance('payment_intent_canceled', {
        reservationId,
        paymentIntentId: paymentIntent.paymentIntentId,
        chargeCents,
      })
      return error(VAL.code, 'Payment was canceled.', VAL.status, request, {
        payment_intent_id: paymentIntent.paymentIntentId,
      })
    }

    // Catch-all for unexpected statuses
    logChargeBalance('payment_intent_unexpected_status', {
      reservationId,
      paymentIntentId: paymentIntent.paymentIntentId,
      status: paymentIntent.status,
      chargeCents,
      maxDueCents,
    })
    return error(
      INT.code,
      `Unexpected PaymentIntent status: ${paymentIntent.status}`,
      INT.status,
      request,
      { payment_intent_id: paymentIntent.paymentIntentId, status: paymentIntent.status },
    )
  } catch (err: unknown) {
    const stripe = stripeFailureFields(err)
    const message = err instanceof Error ? err.message : 'Failed to charge balance'
    console.error('[Charge Balance] charge failed', {
      reservationId,
      message,
      stripe,
      err,
    })
    return error(INT.code, 'Failed to charge balance', INT.status, request, { message })
  }
}
