/**
 * Financial API v1 - Reservation Balance
 *
 * GET /api/v1/financial/reservations/[id]/balance - Get financial balance for reservation
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { summarizeReservationFinancialTransactions } from '@/lib/financial/reservation-amount-due'

/**
 * GET /api/v1/financial/reservations/[id]/balance
 *
 * Get financial summary for a reservation (total, paid, balance).
 */
export async function GET(
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
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Verify reservation exists
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id, total_amount, paid_amount')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // RBAC: verify user has balance view access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.property_id,
      minimumRole: 'staff',
      permission: 'financial.view_balance',
    })
    if (isDenied(access)) return access


    // Execute query — unified ledger from financial_transactions
    const serviceRole = createServiceRoleClient()
    const { data: transactions, error: txnError } = await serviceRole
      .from('financial_transactions')
      .select('type, amount_cents, is_voided, source, handling')
      .eq('reservation_id', reservationId)
      .neq('is_voided', true)
      .eq('status', 'completed')

    if (txnError) {
      console.error('[Financial API v1] Balance query error:', txnError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to query transactions', { message: txnError.message }),
        { status: 500 },
      )
    }

    const reservationTotalAmount = (reservation.total_amount as number | null) ?? 0
    const reservationPaidAmount = (reservation.paid_amount as number | null) ?? 0
    const sums = summarizeReservationFinancialTransactions(
      transactions ?? [],
      reservationTotalAmount,
      reservationPaidAmount,
    )

    if (sums.ledgerBalance !== sums.reservationBalance) {
      console.warn('[Reservation Balance] Ledger vs reservation snapshot differ', {
        reservation_id: reservationId,
        property_id: reservation.property_id,
        ledger_balance_cents: sums.ledgerBalance,
        reservation_snapshot_due_cents: sums.reservationBalance,
        returned_balance_cents: sums.balanceDueCents,
        charges_total_cents: sums.chargesTotal,
        payments_total_cents: sums.paymentsTotal,
        refunds_total_cents: sums.refundsTotal,
        reservation_total_cents: reservationTotalAmount,
        reservation_paid_cents: reservationPaidAmount,
        rule:
          'Field `balance` is reservation total minus paid when total_amount > 0 (authoritative contract). Ledger totals are informational; when they diverge, snapshot wins. If total_amount is 0, balance uses max(0, ledger, snapshot).',
      })
    }

    return success({
      reservation_id: reservationId,
      charges_total: sums.chargesTotal,
      payments_total: sums.paymentsTotal,
      refunds_total: sums.refundsTotal,
      balance: sums.balanceDueCents,
      guest_credit_balance: Math.max(0, sums.guestCreditBalance),
    })
  } catch (err: any) {
    console.error('[Financial API v1] Get reservation balance error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get reservation balance', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
