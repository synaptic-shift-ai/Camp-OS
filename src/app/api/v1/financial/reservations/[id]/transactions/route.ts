/**
 * Financial API v1 - Reservation Transaction History
 *
 * GET /api/v1/financial/reservations/[id]/transactions
 * Paginated transaction history from the unified financial ledger.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'

/**
 * GET /api/v1/financial/reservations/[id]/transactions
 *
 * Paginated transaction history for a reservation.
 *
 * Query params:
 *   type - filter by transaction type (optional)
 *   page - page number (default 1)
 *   pageSize - items per page (default 20, max 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reservationId } = await params
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

    // Verify reservation exists
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 },
      )
    }

    // RBAC
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.property_id,
      minimumRole: 'staff',
      permission: 'financial.view_transactions',
    })
    if (isDenied(access)) return access

    // Parse query params
    const { searchParams } = new URL(request.url)
    const typeFilter = searchParams.get('type') || undefined
    const page = Math.max(1, Math.min(Number(searchParams.get('page')) || 1, 10_000))
    const pageSize = Math.max(1, Math.min(Number(searchParams.get('pageSize')) || 20, 100))
    const offset = (page - 1) * pageSize

    // Query financial_transactions with service role for RLS bypass
    const serviceRole = createServiceRoleClient()

    let query = serviceRole
      .from('financial_transactions')
      .select('id, property_id, reservation_id, invoice_id, type, amount_cents, currency, payment_method, stripe_payment_intent_id, stripe_refund_id, status, processed_at, failure_reason, notes, reconciled_at, reconciled_by, created_at, created_by, updated_at, is_voided, source, guest_id, handling, recognition_status, processor_event_id', { count: 'exact' })
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })

    if (typeFilter) {
      query = query.eq('type', typeFilter)
    }

    const { data: rows, error: txnError, count } = await query
      .range(offset, offset + pageSize - 1)

    if (txnError) {
      console.error('[Financial API v1] Reservation transactions query error:', txnError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to query transactions', { message: txnError.message }),
        { status: 500 },
      )
    }

    // Map created_by user ids to display names so the UI doesn't show raw ids.
    const createdByIds = Array.from(
      new Set((rows ?? []).map((r) => r.created_by).filter((id): id is string => typeof id === 'string' && id.length > 0)),
    )

    const createdByNameById = new Map<string, string>()
    if (createdByIds.length > 0) {
      await Promise.all(
        createdByIds.map(async (userId) => {
          try {
            const { data, error: userError } = await serviceRole.auth.admin.getUserById(userId)
            if (userError || !data.user) {
              createdByNameById.set(userId, 'Staff member')
              return
            }

            const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>
            const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : ''
            const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : ''
            const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : ''
            const fallbackName = [firstName, lastName].filter(Boolean).join(' ').trim()
            const displayName = fullName || fallbackName || data.user.email || 'Staff member'
            createdByNameById.set(userId, displayName)
          } catch {
            createdByNameById.set(userId, 'Staff member')
          }
        }),
      )
    }

    return success({
      reservation_id: reservationId,
      transactions: (rows ?? []).map((row) => ({
        id: row.id,
        property_id: row.property_id,
        reservation_id: row.reservation_id,
        invoice_id: row.invoice_id,
        type: row.type,
        amount_cents: row.amount_cents,
        currency: row.currency,
        payment_method: row.payment_method,
        stripe_payment_intent_id: row.stripe_payment_intent_id,
        stripe_refund_id: row.stripe_refund_id,
        status: row.status,
        processed_at: row.processed_at,
        failure_reason: row.failure_reason,
        notes: row.notes,
        reconciled_at: row.reconciled_at,
        reconciled_by: row.reconciled_by,
        created_at: row.created_at,
        created_by: createdByNameById.get(row.created_by) ?? 'Staff member',
        updated_at: row.updated_at,
        is_voided: row.is_voided ?? false,
        source: row.source,
        guest_id: row.guest_id,
        handling: row.handling,
        recognition_status: row.recognition_status,
        processor_event_id: row.processor_event_id,
      })),
      total: count ?? 0,
      page,
      page_size: pageSize,
    })
  } catch (err: unknown) {
    console.error('[Financial API v1] Reservation transactions error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get reservation transactions', { message }),
      { status: 500 },
    )
  }
}
