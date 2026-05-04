/**
 * recordPaymentDualWrite — Dual-write helper for financial_transactions
 *
 * Creates CHARGE + PAYMENT records in financial_transactions alongside
 * legacy payments writes. Best-effort: failures are logged but never throw.
 *
 * This is a shared helper used by:
 * - Check-in balance payment (check-in.ts)
 * - Reservation confirmation payment (reservation.ts)
 * - Guest self-service payment confirm (`guestInitiatedLedger` in callers such as
 *   `confirmReservationPayment` and the Stripe webhook handler)
 * - Stripe webhook (webhooks/stripe/route.ts)
 */

import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseTransactionRepository } from '../infrastructure/SupabaseTransactionRepository'
import { Transaction } from '../domain/Transaction'
import { TransactionType } from '../domain/value-objects/TransactionType'
import { TransactionSource } from '../domain/value-objects/TransactionSource'
import { type PaymentMethod } from '../domain/value-objects/PaymentMethod'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'

export interface RecordPaymentDualWriteParams {
  supabase: SupabaseClient
  propertyId: string
  reservationId: string | null
  guestId: string | null
  /**
   * Staff auth user id when a property user recorded the payment.
   * If omitted and `reservationId` is set, defaults to looking up `reservations.created_by`
   * unless `guestInitiatedLedger` is true (guest / booking-site checkout).
   */
  createdByUserId?: string | null
  /**
   * When true, never use `reservations.created_by` as a fallback and allow
   * `created_by` to be stored as null on `financial_transactions`.
   */
  guestInitiatedLedger?: boolean
  amountCents: number
  paymentMethod: PaymentMethod
  stripePaymentIntentId?: string | null
  description?: string
  /** Optional processor event ID for dedup (e.g., Stripe event ID) */
  processorEventId?: string | null
  /** Log prefix for contextual logging */
  logPrefix?: string
}

/**
 * Write CHARGE + PAYMENT records to financial_transactions.
 *
 * Best-effort: never throws. Logs errors but allows the caller to continue.
 */
export async function recordPaymentDualWrite(
  params: RecordPaymentDualWriteParams,
): Promise<void> {
  const {
    supabase,
    propertyId,
    reservationId,
    guestId,
    createdByUserId = null,
    guestInitiatedLedger = false,
    amountCents,
    paymentMethod,
    stripePaymentIntentId = null,
    description,
    processorEventId = null,
    logPrefix = '[DualWrite]',
  } = params

  try {
    const repo = new SupabaseTransactionRepository(supabase as any)
    const amount = MoneyAmount.create(amountCents)

    let resolvedCreatedByUserId = createdByUserId ?? null
    if (!guestInitiatedLedger && !resolvedCreatedByUserId && reservationId) {
      const { data: reservationRow, error: reservationLookupError } = await (supabase as any)
        .from('reservations')
        .select('created_by')
        .eq('id', reservationId)
        .eq('property_id', propertyId)
        .maybeSingle()

      if (reservationLookupError) {
        console.warn(`${logPrefix} could not resolve created_by from reservation (non-blocking)`, {
          reservationId,
          error: reservationLookupError.message,
        })
      } else if (reservationRow?.created_by) {
        resolvedCreatedByUserId = reservationRow.created_by as string
      }
    }

    if (!resolvedCreatedByUserId && !guestInitiatedLedger) {
      console.warn(`${logPrefix} skipped (missing createdByUserId)`, { propertyId, reservationId })
      return
    }
    // Idempotency check — skip if we already processed this event
    if (processorEventId) {
      const existingCharge = await repo.findByProcessorEventId(processorEventId, TransactionType.CHARGE)
      const existingPayment = await repo.findByProcessorEventId(processorEventId, TransactionType.PAYMENT)
      if (existingCharge || existingPayment) {
        console.log(`${logPrefix} skipped (already exists)`, { processorEventId })
        return
      }
    }

    // Create CHARGE record
    const chargeId = randomUUID()
    const charge = Transaction.create(
      chargeId,
      propertyId,
      reservationId,
      TransactionType.CHARGE,
      amount,
      paymentMethod,
      resolvedCreatedByUserId,
      null, // invoiceId
      description ?? 'Charge via dual-write',
      TransactionSource.RESERVATION,
      processorEventId,
      guestId,
    )
    charge.complete(stripePaymentIntentId)
    await repo.save(charge)
    console.log(`${logPrefix} CHARGE created: ${chargeId}`)

    // Create PAYMENT record
    const paymentId = randomUUID()
    const payment = Transaction.create(
      paymentId,
      propertyId,
      reservationId,
      TransactionType.PAYMENT,
      amount,
      paymentMethod,
      resolvedCreatedByUserId,
      null, // invoiceId
      description ?? 'Payment via dual-write',
      TransactionSource.RESERVATION,
      processorEventId,
      guestId,
    )
    payment.complete(stripePaymentIntentId)
    await repo.save(payment)
    console.log(`${logPrefix} PAYMENT created: ${paymentId}`)
  } catch (ftError: any) {
    // Best-effort: log but don't fail the caller
    const isConstraintViolation =
      ftError?.message?.includes('duplicate key') ||
      ftError?.message?.includes('unique constraint') ||
      ftError?.message?.includes('23505')
    if (isConstraintViolation) {
      console.warn(`${logPrefix} skipped (race condition, already exists)`, {
        processorEventId,
        error: ftError.message,
      })
    } else {
      console.error(`${logPrefix} failed (non-blocking)`, {
        propertyId,
        reservationId,
        amountCents,
        error: ftError,
      })
    }
  }
}
