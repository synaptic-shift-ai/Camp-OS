/**
 * Financial API v1 - Transaction Details
 *
 * GET /api/v1/financial/transactions/[id] - Get transaction by ID
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
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

    // Get user's company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Company not found'),
        { status: 404 }
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

    // Verify tenant access (BP-4)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', transaction.propertyId)
      .single()

    if (propertyError || !property || property.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - transaction belongs to different company'),
        { status: 403 }
      )
    }

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
