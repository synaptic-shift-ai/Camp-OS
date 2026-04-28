/**
 * recordPaymentDualWrite — Dual-write helper for financial_transactions
 *
 * Creates CHARGE + PAYMENT records in financial_transactions alongside
 * legacy payments writes. Best-effort: failures are logged but never throw.
 *
 * This is a shared helper used by:
 * - Check-in balance payment (check-in.ts)
 * - Reservation confirmation payment (reservation.ts)
 * - Guest self-service payment confirm (guest/payment/confirm/route.ts)
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
      'system',
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
      'system',
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
