/**
 * Financial API v1 - Transaction Details
 *
 * GET /api/v1/financial/transactions/[id] - Get transaction by ID
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { GetTransactionQueryHandler } from '@/modules/Financial/application/queries/GetTransactionQuery'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { toTransactionDTO } from '@/modules/Financial/application/DTOs/TransactionDTO'

/**
 * GET /api/v1/financial/transactions/[id]
 *
 * Get a single transaction by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params
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

    // Execute query
    const repository = new SupabaseTransactionRepository(supabase)
    const queryHandler = new GetTransactionQueryHandler(repository)
    const transaction = await queryHandler.execute(transactionId)

    if (!transaction) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Transaction not found'),
        { status: 404 }
      )
    }

    // RBAC: verify user has view access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: transaction.propertyId,
      minimumRole: 'staff',
      permission: 'financial.view_transactions',
    })
    if (isDenied(access)) return access


    // Convert to DTO
    const transactionDTO = toTransactionDTO(transaction)

    return success(transactionDTO)
  } catch (err: any) {
    console.error('[Financial API v1] Get transaction error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get transaction', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
