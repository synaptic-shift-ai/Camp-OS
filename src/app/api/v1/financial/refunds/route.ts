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
import { sendRefundIssuedEmail } from '@/lib/email/send'
import { canAutomationHandleEmail } from '@/lib/automations/email-guard'

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

    // Try v2 schema first (has payment_id + handling)
    const v2Validated = ProcessRefundV2RequestSchema.safeParse(body)
    if (v2Validated.success) {
      return handleV2Refund(v2Validated.data, user.id, supabase, request)
    }

    // Fall back to v1 schema
    const validated = ProcessRefundRequestSchema.safeParse(body)

    if (!validated.success) {
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

    // 7. Send refund notification email
    try {
      const { data: emailData, error: emailError } = await supabase
        .from('reservations')
        .select('confirmation_number, guest:guests(first_name, last_name, email), property:properties(name)')
        .eq('id', validated.data.reservationId)
        .single()

      if (!emailError && emailData) {
        const guest = emailData.guest as unknown as { first_name: string; last_name: string; email: string } | null
        const propertyRow = emailData.property as unknown as { name: string } | null

        if (guest?.email && propertyRow) {
          const guestName = `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || 'Guest'

          const automationHandlesEmail = await canAutomationHandleEmail(
            'refund.processed',
            reservation.property_id,
            'refund_issued',
          )

          if (!automationHandlesEmail) {
            sendRefundIssuedEmail({
              guestName,
              guestEmail: guest.email,
              confirmationNumber: emailData.confirmation_number,
              propertyName: propertyRow.name,
              refundAmountCents: validated.data.amountCents,
            }).catch((err) => {
              console.error('[Financial Refund] Failed to send refund-issued email:', err)
            })
          } else {
            console.log('[Financial Refund] Automation handles email, skipping direct send')
          }
        }
      }
    } catch (emailErr) {
      console.error('[Financial Refund] Email lookup/send failed (non-blocking):', emailErr)
    }

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
  if (isDenied(access)) return access

  // Validate refund amount doesn't exceed original payment
  if (data.amount_cents > payment.amount_cents) {
    return NextResponse.json(
      error(ErrorCodes.VALIDATION_ERROR, 'Refund amount cannot exceed original payment amount'),
      { status: 400 },
    )
  }

  const repo = new SupabaseTransactionRepository(serviceRole)
  const amount = MoneyAmount.create(data.amount_cents)

  const refund = Transaction.create(
    crypto.randomUUID(),
    payment.property_id,
    payment.reservation_id,
    TransactionType.REFUND,
    amount,
    payment.payment_method as PaymentMethod,
    userId,
    null, // invoiceId
    data.reason ?? `Refund for payment ${data.payment_id}`,
    TransactionSource.RESERVATION,
    null, // processorEventId
    payment.guest_id,
  )

  refund.setHandling(data.handling as RefundHandling)
  refund.complete()
  await repo.save(refund)

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

  // Send refund notification email
  if (payment.reservation_id) {
    try {
      const { data: emailData, error: emailError } = await supabase
        .from('reservations')
        .select('confirmation_number, guest:guests(first_name, last_name, email), property:properties(name)')
        .eq('id', payment.reservation_id)
        .single()

      if (!emailError && emailData) {
        const guest = emailData.guest as unknown as { first_name: string; last_name: string; email: string } | null
        const propertyRow = emailData.property as unknown as { name: string } | null

        if (guest?.email && propertyRow) {
          const guestName = `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || 'Guest'

          const automationHandlesEmail = await canAutomationHandleEmail(
            'refund.processed',
            payment.property_id,
            'refund_issued',
          )

          if (!automationHandlesEmail) {
            sendRefundIssuedEmail({
              guestName,
              guestEmail: guest.email,
              confirmationNumber: emailData.confirmation_number,
              propertyName: propertyRow.name,
              refundAmountCents: data.amount_cents,
            }).catch((err) => {
              console.error('[Financial Refund V2] Failed to send refund-issued email:', err)
            })
          } else {
            console.log('[Financial Refund V2] Automation handles email, skipping direct send')
          }
        }
      }
    } catch (emailErr) {
      console.error('[Financial Refund V2] Email lookup/send failed (non-blocking):', emailErr)
    }

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
