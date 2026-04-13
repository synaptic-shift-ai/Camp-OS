/**
 * Reservations API v1 - Get Balance
 *
 * Phase 4C: API Consolidation
 *
 * GET /api/v1/reservations/[id]/balance - Get reservation financial balance
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
 * GET /api/v1/reservations/[id]/balance
 *
 * Get the financial balance for a reservation.
 * Returns total amount, paid amount, balance due, and invoice summary.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
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

    // 2. Verify reservation exists
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

    // 3. RBAC: verify user has balance view access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.property_id,
      minimumRole: 'staff',
      permission: 'financial.view_balance',
    })
    if (isDenied(access)) return access


    // 5. Execute query
    const transactionRepository = new SupabaseTransactionRepository(supabase)
    const invoiceRepository = new SupabaseInvoiceRepository(supabase)
    const handler = new GetReservationBalanceQueryHandler(
      transactionRepository,
      invoiceRepository
    )

    const balance = await handler.execute(reservationId)

    // 6. Return response
    return success(balance)
  } catch (err: unknown) {
    console.error('[Reservations API v1] Get balance error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get reservation balance', { message }),
      { status: 500 }
    )
  }
}
