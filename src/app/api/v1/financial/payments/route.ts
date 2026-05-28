/**
 * Financial API v1 - Payments (v2)
 *
 * POST /api/v1/financial/payments - Record a payment against a charge, reservation, or guest
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { RecordPaymentV2RequestSchema } from '@/types/api/v1/schemas/financial'
import { Transaction } from '@/modules/Financial/domain/Transaction'
import { TransactionType } from '@/modules/Financial/domain/value-objects/TransactionType'
import { TransactionSource } from '@/modules/Financial/domain/value-objects/TransactionSource'
import { PaymentMethod } from '@/modules/Financial/domain/value-objects/PaymentMethod'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { toTransactionDTO } from '@/modules/Financial/application/DTOs/TransactionDTO'
import { getEffectiveGuestCreditAvailableCents } from '@/modules/Financial/application/guestCreditBalance'
import { queuePaymentReceiptEmail } from '@/modules/Financial/application/queuePaymentReceiptEmail'

function mapPaymentMethod(method: string): PaymentMethod {
  const map: Record<string, PaymentMethod> = {
    credit_card: PaymentMethod.CREDIT_CARD,
    debit_card: PaymentMethod.DEBIT_CARD,
    cash: PaymentMethod.CASH,
    check: PaymentMethod.CHECK,
    bank_transfer: PaymentMethod.BANK_TRANSFER,
    stripe: PaymentMethod.STRIPE,
    store_credit: PaymentMethod.STORE_CREDIT,
  }
  return map[method] ?? PaymentMethod.CASH
}

function mapSource(source: string): TransactionSource {
  const map: Record<string, TransactionSource> = {
    reservation: TransactionSource.RESERVATION,
    manual: TransactionSource.MANUAL,
    pos: TransactionSource.POS,
    system: TransactionSource.SYSTEM,
    guest_credit: TransactionSource.GUEST_CREDIT,
  }
  return map[source] ?? TransactionSource.RESERVATION
}

/**
 * POST /api/v1/financial/payments
 *
 * Record a payment. Supports guest_credit source with balance validation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 },
      )
    }

    const body = await request.json()
    const validated = RecordPaymentV2RequestSchema.safeParse(body)

    if (!validated.success) {
      console.warn('[Financial API v1] Record payment: request body validation failed', {
        issues: validated.error.issues.map((i) => ({
          path: i.path.join('.') || '(root)',
          code: i.code,
          message: i.message,
        })),
      })
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 },
      )
    }

    const {
      charge_id: _charge_id,
      reservation_id,
      guest_id,
      amount_cents,
      payment_method,
      processor,
      source,
    } = validated.data

    // Resolve property_id
    let propertyId: string | null = null
    let reservationTotals:
      | {
          total_amount: number
          paid_amount: number | null
          status: string
          payment_status: string | null
          confirmation_number: string
          guest_id: string | null
        }
      | null = null

    if (reservation_id) {
      const { data: reservation } = await supabase
        .from('reservations')
        .select(
          'id, property_id, total_amount, paid_amount, status, payment_status, confirmation_number, guest_id',
        )
        .eq('id', reservation_id)
        .single()

      if (!reservation) {
        return NextResponse.json(
          error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
          { status: 404 },
        )
      }
      propertyId = reservation.property_id
      reservationTotals = {
        total_amount: reservation.total_amount as number,
        paid_amount: (reservation.paid_amount as number | null) ?? 0,
        status: reservation.status as string,
        payment_status: (reservation.payment_status as string | null) ?? null,
        confirmation_number: reservation.confirmation_number as string,
        guest_id: (reservation.guest_id as string | null) ?? null,
      }
    }

    if (!propertyId && guest_id) {
      const { data: guest } = await supabase
        .from('guests')
        .select('id, property_id')
        .eq('id', guest_id)
        .single()

      if (!guest) {
        return NextResponse.json(
          error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found'),
          { status: 404 },
        )
      }
      propertyId = guest.property_id
    }

    if (!propertyId) {
      console.warn('[Financial API v1] Record payment: could not resolve property_id', {
        reservationId: reservation_id ?? null,
        guestId: guest_id ?? null,
        source,
      })
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Could not determine property'),
        { status: 400 },
      )
    }

    // RBAC
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'financial.record_payment',
    })
    if (isDenied(access)) return access

    const sourceEnum = mapSource(source)
    const amount = MoneyAmount.create(amount_cents)

    // Guest credit: allow spend up to max(ledger, guests.guest_credit_cents) so UI and API agree.
    if (sourceEnum === TransactionSource.GUEST_CREDIT && guest_id && propertyId) {
      const creditServiceRole = createServiceRoleClient()
      const effective = await getEffectiveGuestCreditAvailableCents(
        creditServiceRole,
        guest_id,
        propertyId,
      )

      if (effective.effectiveAvailableCents < amount_cents) {
        console.warn('[Financial API v1] Record payment: guest credit rejected — insufficient spendable balance', {
          guestId: guest_id,
          propertyId,
          reservationId: reservation_id ?? null,
          requestedAmountCents: amount_cents,
          effectiveAvailableCents: effective.effectiveAvailableCents,
          ledgerBalanceCents: effective.ledger.creditBalance,
          ledgerTotalCreditsCents: effective.ledger.totalCredits,
          ledgerTotalUsedCents: effective.ledger.totalUsed,
          guestsTableGuestCreditCents: effective.guestsColumnCents,
        })
        return NextResponse.json(
          error(ErrorCodes.VALIDATION_ERROR, 'Insufficient guest credit balance', {
            available: effective.effectiveAvailableCents,
            requested: amount_cents,
            ledger_balance_cents: effective.ledger.creditBalance,
            guests_table_guest_credit_cents: effective.guestsColumnCents,
          }),
          { status: 400 },
        )
      }
    }

    // Create payment via DDD
    const serviceRole = createServiceRoleClient()
    const repo = new SupabaseTransactionRepository(serviceRole)

    const payment = Transaction.create(
      crypto.randomUUID(),
      propertyId,
      reservation_id ?? null,
      TransactionType.PAYMENT,
      amount,
      mapPaymentMethod(payment_method),
      user.id,
      null, // invoiceId
      null, // notes
      sourceEnum,
      processor ?? null, // processorEventId
      guest_id ?? null,
    )

    payment.complete(processor ?? null)
    await repo.save(payment)

    // Decrement denormalized guest credit (guests.guest_credit_cents), matching refund guest_credit handling.
    // GET credit-balance prefers this column when set; ledger alone left the balance unchanged in the UI.
    if (sourceEnum === TransactionSource.GUEST_CREDIT && guest_id && propertyId && amount_cents > 0) {
      try {
        const { data: guestRow, error: guestLookupError } = await serviceRole
          .from('guests')
          .select('id, guest_credit_cents')
          .eq('id', guest_id)
          .eq('property_id', propertyId)
          .maybeSingle()

        if (guestLookupError) {
          console.error('[Financial API v1] Record payment: guest credit lookup failed (non-blocking)', {
            guestId: guest_id,
            propertyId,
            error: guestLookupError,
          })
        } else if (guestRow) {
          const previousCredit = (guestRow.guest_credit_cents as number | null) ?? 0
          const nextCredit = Math.max(0, previousCredit - amount_cents)
          const { error: guestUpdateError } = await serviceRole
            .from('guests')
            .update({
              guest_credit_cents: nextCredit,
              updated_at: new Date().toISOString(),
            })
            .eq('id', guest_id)
            .eq('property_id', propertyId)

          if (guestUpdateError) {
            console.error('[Financial API v1] Record payment: guest credit decrement failed (non-blocking)', {
              guestId: guest_id,
              propertyId,
              error: guestUpdateError,
            })
          }
        } else {
          console.warn('[Financial API v1] Record payment: guest not found for guest credit decrement (non-blocking)', {
            guestId: guest_id,
            propertyId,
          })
        }
      } catch (e) {
        console.error('[Financial API v1] Record payment: guest credit decrement threw (non-blocking)', e)
      }
    }

    // Update reservation snapshot amounts so dashboards reflect the payment immediately.
    // (The reservations UI reads paid_amount/payment_status from reservations, not just the ledger.)
    if (reservation_id && propertyId && reservationTotals) {
      const previousPaid = reservationTotals.paid_amount ?? 0
      const nextPaid = previousPaid + amount_cents

      const totalAmount = reservationTotals.total_amount ?? 0
      const nextPaymentStatus =
        nextPaid >= totalAmount ? 'paid' : nextPaid > 0 ? 'partial' : 'pending'

      // When fully paid, cap paid_amount at total_amount (not cash received)
      const cappedPaid = nextPaymentStatus === 'paid' ? totalAmount : nextPaid

      const reservationUpdate: Record<string, unknown> = {
        paid_amount: cappedPaid,
        payment_status: nextPaymentStatus,
        updated_at: new Date().toISOString(),
      }

      // If a reservation is pending, confirm it only when fully paid.
      if (reservationTotals.status === 'pending' && nextPaid >= totalAmount) {
        reservationUpdate.status = 'confirmed'
      }

      const { error: reservationUpdateError } = await serviceRole
        .from('reservations')
        .update(reservationUpdate)
        .eq('id', reservation_id)
        .eq('property_id', propertyId)

      if (reservationUpdateError) {
        console.error('[Financial API v1] Record payment: reservation update failed (non-blocking)', {
          reservationId: reservation_id,
          propertyId,
          error: reservationUpdateError,
        })
      }
    }

    const paymentRecordId = payment.id
    const targetGuestId = guest_id ?? reservationTotals?.guest_id ?? null
    if (targetGuestId && amount_cents > 0) {
      void queuePaymentReceiptEmail({
        serviceRole,
        propertyId,
        reservationId: reservation_id ?? null,
        guestId: targetGuestId,
        amountCents: amount_cents,
        paymentRecordId,
        paymentMethodForLabel: payment_method,
        sourceForLabel: source,
        rbacCompanyId: access.companyId ?? null,
        reservationTotals,
      })
    }

    const dto = toTransactionDTO(payment)
    return NextResponse.json(success(dto), { status: 201 })
  } catch (err: unknown) {
    console.error('[Financial API v1] Record payment error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment', { message }),
      { status: 500 },
    )
  }
}
