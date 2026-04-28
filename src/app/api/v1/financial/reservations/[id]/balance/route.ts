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
      .select('id, property_id')
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

    let chargesTotal = 0
    let paymentsTotal = 0
    let refundsTotal = 0
    let guestCreditBalance = 0

    for (const txn of transactions ?? []) {
      const amt = txn.amount_cents
      if (txn.type === 'charge') {
        chargesTotal += amt
      } else if (txn.type === 'payment') {
        paymentsTotal += amt
        // Track guest credit payments for balance calculation
        if (txn.source === 'guest_credit') {
          guestCreditBalance -= amt
        }
      } else if (txn.type === 'refund') {
        refundsTotal += amt
        // Track guest credit refunds for balance calculation
        if (txn.source === 'guest_credit' || txn.handling === 'guest_credit') {
          guestCreditBalance += amt
        }
      }
    }

    const balance = chargesTotal - paymentsTotal - refundsTotal

    return success({
      reservation_id: reservationId,
      charges_total: chargesTotal,
      payments_total: paymentsTotal,
      refunds_total: refundsTotal,
      balance,
      guest_credit_balance: Math.max(0, guestCreditBalance),
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
