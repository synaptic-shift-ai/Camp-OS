/**
 * Financial API v1 - Reservation Balance
 *
 * GET /api/v1/financial/reservations/[id]/balance - Get financial balance for reservation
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { GetReservationBalanceQueryHandler } from '@/modules/Financial/application/queries/GetReservationBalanceQuery'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { SupabaseInvoiceRepository } from '@/modules/Financial/infrastructure/SupabaseInvoiceRepository'

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


    // Execute query
    const transactionRepository = new SupabaseTransactionRepository(supabase)
    const invoiceRepository = new SupabaseInvoiceRepository(supabase)
    const queryHandler = new GetReservationBalanceQueryHandler(
      transactionRepository,
      invoiceRepository
    )

    const balance = await queryHandler.execute(reservationId)

    return success(balance)
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
