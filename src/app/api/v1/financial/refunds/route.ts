/**
 * Financial API v1 - Refunds
 *
 * Phase 4C: API Consolidation
 *
 * POST /api/v1/financial/refunds - Process a refund
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import {
  ProcessRefundRequestSchema,
  ProcessRefundV2RequestSchema,
} from '@/types/api/v1/schemas/financial'
import { ProcessRefundCommandHandler } from '@/modules/Financial/application/commands/ProcessRefundCommand'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { toTransactionDTO } from '@/modules/Financial/application/DTOs/TransactionDTO'
import { PaymentMethod } from '@/modules/Financial'
import { Transaction } from '@/modules/Financial/domain/Transaction'
import { TransactionType } from '@/modules/Financial/domain/value-objects/TransactionType'
import { TransactionSource } from '@/modules/Financial/domain/value-objects/TransactionSource'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import type { RefundHandling } from '@/modules/Financial/domain/value-objects/RefundHandling'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/v1/financial/refunds
 *
 * Process a refund for a reservation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body = await request.json()

    console.warn('[Financial API v1] POST /financial/refunds: request received', {
      userId: user.id,
      keys: body && typeof body === 'object' ? Object.keys(body as object) : [],
      payment_id: typeof body?.payment_id === 'string' ? body.payment_id : undefined,
      amount_cents: typeof body?.amount_cents === 'number' ? body.amount_cents : undefined,
      handling: typeof body?.handling === 'string' ? body.handling : undefined,
      reservationId: typeof body?.reservationId === 'string' ? body.reservationId : undefined,
    })

    // Try v2 schema first (has payment_id + handling)
    const v2Validated = ProcessRefundV2RequestSchema.safeParse(body)
    if (v2Validated.success) {
      return handleV2Refund(v2Validated.data, user.id, supabase, request)
    }

    console.warn('[Financial API v1] POST /financial/refunds: v2 schema not used', {
      userId: user.id,
      v2Issues: v2Validated.error.flatten(),
    })

    // Fall back to v1 schema
    const validated = ProcessRefundRequestSchema.safeParse(body)

    if (!validated.success) {
      console.warn('[Financial API v1] POST /financial/refunds: v1 schema validation failed (400)', {
        userId: user.id,
        v1Issues: validated.error.flatten(),
        v2Issues: v2Validated.error.flatten(),
      })
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 }
      )
    }

    // 3. Verify reservation exists
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id, paid_amount, refund_amount_cents')
      .eq('id', validated.data.reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // 4. RBAC: verify user has refund access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.property_id,
      minimumRole: 'admin',
      permission: 'financial.refund',
    })
    if (isDenied(access)) return access


    // 6. Execute command
    const repository = new SupabaseTransactionRepository(supabase)
    const handler = new ProcessRefundCommandHandler(repository)

    const transactionId = crypto.randomUUID()

    // Map payment method string to enum
    const paymentMethodMap: Record<string, PaymentMethod> = {
      stripe: PaymentMethod.STRIPE,
      cash: PaymentMethod.CASH,
      check: PaymentMethod.CHECK,
      bank_transfer: PaymentMethod.BANK_TRANSFER,
      credit_card: PaymentMethod.CREDIT_CARD,
      debit_card: PaymentMethod.DEBIT_CARD,
      store_credit: PaymentMethod.STORE_CREDIT,
    }

    const refund = await handler.execute({
      transactionId,
      propertyId: reservation.property_id,
      reservationId: validated.data.reservationId,
      amountCents: validated.data.amountCents,
      paymentMethod: paymentMethodMap[validated.data.paymentMethod] || PaymentMethod.STRIPE,
      originalTransactionId: validated.data.originalTransactionId ?? null,
      stripeRefundId: validated.data.stripeRefundId ?? null,
      reason: validated.data.reason ?? null,
      createdBy: user.id,
    })

    // Update reservation snapshot refund totals so UI reflects refunds immediately.
    // (Reservation dashboards read refund_amount_cents/payment_status from reservations.)
    try {
      const serviceRole = createServiceRoleClient()
      const previousRefund = (reservation.refund_amount_cents as number | null) ?? 0
      const nextRefund = previousRefund + validated.data.amountCents
      const paidAmount = (reservation.paid_amount as number | null) ?? 0
      const nextPaymentStatus =
        nextRefund >= paidAmount ? 'refunded' : nextRefund > 0 ? 'partially_refunded' : 'paid'

      const { error: reservationUpdateError } = await serviceRole
        .from('reservations')
        .update({
          refund_amount_cents: nextRefund,
          payment_status: nextPaymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', validated.data.reservationId)
        .eq('property_id', reservation.property_id)

      if (reservationUpdateError) {
        console.error('[Financial API v1] Process refund: reservation update failed (non-blocking)', {
          reservationId: validated.data.reservationId,
          error: reservationUpdateError,
        })
      }
    } catch (reservationUpdateErr) {
      console.error('[Financial API v1] Process refund: reservation update threw (non-blocking)', reservationUpdateErr)
    }

    // 7. Email is handled by automation pipeline only (no direct fallback)

    // 8. Trigger automation pipeline
    try {
      const { triggerReservationAutomations } = await import('@/lib/automations/run-pipeline')
      await triggerReservationAutomations(
        'refund.processed',
        validated.data.reservationId,
        reservation.property_id,
        access.companyId!,
      )
    } catch (err) {
      console.error('[Financial Refund] Failed to trigger automation:', err)
    }

    // 9. Convert to DTO and return
    const refundDTO = toTransactionDTO(refund)

    return NextResponse.json(success(refundDTO), { status: 201 })
  } catch (err: unknown) {
    console.error('[Financial API v1] Process refund error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to process refund', { message }),
      { status: 500 }
    )
  }
}

/**
 * V2 refund handler using DDD Transaction.create() with handling support.
 */
async function handleV2Refund(
  data: { payment_id: string; amount_cents: number; handling: 'original_method' | 'guest_credit'; reason?: string | null | undefined },
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  _request: NextRequest,
) {
  console.warn('[Financial API v1] POST /financial/refunds: processing v2 refund', {
    userId,
    payment_id: data.payment_id,
    amount_cents: data.amount_cents,
    handling: data.handling,
  })

  // Look up the original payment to get property_id and reservation_id
  const serviceRole = createServiceRoleClient()
  const { data: payment, error: paymentError } = await serviceRole
    .from('financial_transactions')
    .select('id, property_id, reservation_id, guest_id, payment_method, amount_cents')
    .eq('id', data.payment_id)
    .eq('type', 'payment')
    .eq('status', 'completed')
    .neq('is_voided', true)
    .single()

  if (paymentError || !payment) {
    console.warn('[Financial API v1] POST /financial/refunds: v2 payment lookup failed (404)', {
      userId,
      payment_id: data.payment_id,
      supabaseError: paymentError
        ? { message: paymentError.message, code: paymentError.code, details: paymentError.details }
        : null,
      rowFound: Boolean(payment),
    })
    return NextResponse.json(
      error(ErrorCodes.RESOURCE_NOT_FOUND, 'Payment not found or invalid'),
      { status: 404 },
    )
  }

  // RBAC
  const access = await requirePropertyAccess(supabase, userId, {
    propertyId: payment.property_id,
    minimumRole: 'admin',
    permission: 'financial.refund',
  })
  if (isDenied(access)) {
    console.warn('[Financial API v1] POST /financial/refunds: v2 RBAC denied', {
      userId,
      propertyId: payment.property_id,
      payment_id: data.payment_id,
    })
    return access
  }

  // Refund cap: guest_credit may refund up to remaining paid on the reservation (guest credit +
  // cash are separate ledger rows; UI often passes the first payment id only). original_method
  // stays capped to the selected payment row.
  let maxRefundableCents = payment.amount_cents as number
  if (data.handling === 'guest_credit' && payment.reservation_id) {
    const { data: resCap, error: resCapError } = await serviceRole
      .from('reservations')
      .select('paid_amount, refund_amount_cents')
      .eq('id', payment.reservation_id)
      .eq('property_id', payment.property_id)
      .maybeSingle()

    if (!resCapError && resCap) {
      const paid = (resCap.paid_amount as number | null) ?? 0
      const alreadyRefunded = (resCap.refund_amount_cents as number | null) ?? 0
      maxRefundableCents = Math.max(0, paid - alreadyRefunded)
    }
  }

  if (data.amount_cents > maxRefundableCents) {
    console.warn('[Financial API v1] POST /financial/refunds: v2 refund amount exceeds cap (400)', {
      userId,
      payment_id: data.payment_id,
      reservation_id: payment.reservation_id,
      property_id: payment.property_id,
      requested_amount_cents: data.amount_cents,
      original_payment_row_cents: payment.amount_cents,
      max_refundable_cents_applied: maxRefundableCents,
      handling: data.handling,
    })
    return NextResponse.json(
      error(
        ErrorCodes.VALIDATION_ERROR,
        data.handling === 'guest_credit'
          ? 'Refund amount cannot exceed remaining paid balance on this reservation'
          : 'Refund amount cannot exceed original payment amount',
      ),
      { status: 400 },
    )
  }

  const repo = new SupabaseTransactionRepository(serviceRole)
  const amount = MoneyAmount.create(data.amount_cents)

  const isGuestCredit = data.handling === 'guest_credit'
  const refundPaymentMethod: PaymentMethod = isGuestCredit
    ? PaymentMethod.STORE_CREDIT
    : (payment.payment_method as PaymentMethod)

  // Some legacy payment rows may not have guest_id populated.
  // For guest_credit handling we can fall back to the reservation's guest_id.
  let resolvedGuestId: string | null = (payment.guest_id as string | null) ?? null
  if (isGuestCredit && !resolvedGuestId && payment.reservation_id) {
    const { data: reservationRow, error: reservationLookupError } = await serviceRole
      .from('reservations')
      .select('id, guest_id')
      .eq('id', payment.reservation_id)
      .eq('property_id', payment.property_id)
      .maybeSingle()

    if (reservationLookupError) {
      console.error('[Financial API v1] V2 refund: reservation guest lookup failed (non-blocking)', {
        reservationId: payment.reservation_id,
        propertyId: payment.property_id,
        error: reservationLookupError,
      })
    } else if (reservationRow?.guest_id) {
      resolvedGuestId = reservationRow.guest_id as string
    }
  }

  const refund = Transaction.create(
    crypto.randomUUID(),
    payment.property_id,
    payment.reservation_id,
    TransactionType.REFUND,
    amount,
    refundPaymentMethod,
    userId,
    null, // invoiceId
    data.reason ?? `Refund for payment ${data.payment_id}`,
    TransactionSource.RESERVATION,
    null, // processorEventId
    resolvedGuestId,
  )

  refund.setHandling(data.handling as RefundHandling)
  refund.complete()
  await repo.save(refund)

  // If refund is issued as guest credit, increment guest's credit balance (property-scoped).
  // This is intentionally separate from the transaction ledger so UI can show a fast balance.
  if (isGuestCredit && resolvedGuestId) {
    try {
      const { data: guestRow, error: guestLookupError } = await serviceRole
        .from('guests')
        .select('id, property_id, guest_credit_cents')
        .eq('id', resolvedGuestId)
        .eq('property_id', payment.property_id)
        .maybeSingle()

      if (guestLookupError) {
        console.error('[Financial API v1] V2 refund: guest lookup failed (non-blocking)', {
          guestId: resolvedGuestId,
          propertyId: payment.property_id,
          error: guestLookupError,
        })
      } else if (guestRow) {
        const previousCredit = (guestRow.guest_credit_cents as number | null) ?? 0
        const nextCredit = previousCredit + data.amount_cents

        const { error: guestUpdateError } = await serviceRole
          .from('guests')
          .update({
            guest_credit_cents: nextCredit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolvedGuestId)
          .eq('property_id', payment.property_id)

        if (guestUpdateError) {
          console.error('[Financial API v1] V2 refund: guest credit update failed (non-blocking)', {
            guestId: resolvedGuestId,
            propertyId: payment.property_id,
            error: guestUpdateError,
          })
        }
      }
    } catch (e) {
      console.error('[Financial API v1] V2 refund: guest credit update threw (non-blocking)', e)
    }
  }

  // Update reservation snapshot refund totals so reservations UI reflects the refund.
  if (payment.reservation_id) {
    try {
      const { data: reservationRow, error: reservationError } = await serviceRole
        .from('reservations')
        .select('paid_amount, refund_amount_cents')
        .eq('id', payment.reservation_id)
        .eq('property_id', payment.property_id)
        .maybeSingle()

      if (reservationError) {
        console.error('[Financial API v1] V2 refund: reservation lookup failed (non-blocking)', {
          reservationId: payment.reservation_id,
          error: reservationError,
        })
      } else if (reservationRow) {
        const previousRefund = (reservationRow.refund_amount_cents as number | null) ?? 0
        const nextRefund = previousRefund + data.amount_cents
        const paidAmount = (reservationRow.paid_amount as number | null) ?? 0
        const nextPaymentStatus =
          nextRefund >= paidAmount ? 'refunded' : nextRefund > 0 ? 'partially_refunded' : 'paid'

        const { error: updateError } = await serviceRole
          .from('reservations')
          .update({
            refund_amount_cents: nextRefund,
            payment_status: nextPaymentStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.reservation_id)
          .eq('property_id', payment.property_id)

        if (updateError) {
          console.error('[Financial API v1] V2 refund: reservation update failed (non-blocking)', {
            reservationId: payment.reservation_id,
            error: updateError,
          })
        }
      }
    } catch (e) {
      console.error('[Financial API v1] V2 refund: reservation update threw (non-blocking)', e)
    }
  }

  // Email is handled by automation pipeline only (no direct fallback)

  if (payment.reservation_id) {
    // Trigger automation pipeline
    try {
      const { triggerReservationAutomations } = await import('@/lib/automations/run-pipeline')
      await triggerReservationAutomations(
        'refund.processed',
        payment.reservation_id,
        payment.property_id,
        access.companyId!,
      )
    } catch (err) {
      console.error('[Financial Refund V2] Failed to trigger automation:', err)
    }
  }
  return NextResponse.json(success(toTransactionDTO(refund)), { status: 201 })
}
