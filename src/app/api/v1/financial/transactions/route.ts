/**
 * Financial API v1 - Transactions
 *
 * GET /api/v1/financial/transactions - List all transactions
 * POST /api/v1/financial/transactions - Record a payment transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  RecordPaymentRequestSchema,
  TransactionFiltersSchema,
} from '@/types/api/v1/schemas/financial'
import { RecordPaymentCommandHandler } from '@/modules/Financial/application/commands/RecordPaymentCommand'
import { GetPropertyTransactionsQueryHandler } from '@/modules/Financial/application/queries/GetPropertyTransactionsQuery'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { SupabaseInvoiceRepository } from '@/modules/Financial/infrastructure/SupabaseInvoiceRepository'
import { toTransactionDTO } from '@/modules/Financial/application/DTOs/TransactionDTO'
import type { TransactionType, TransactionStatus } from '@/modules/Financial'

/**
 * GET /api/v1/financial/transactions
 *
 * List all transactions for the user's properties with optional filtering.
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get user's company and properties (BP-4: Multi-tenant isolation)
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

    // Get all properties for this company
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id')
      .eq('company_id', company.id)

    if (propertiesError || !properties || properties.length === 0) {
      return success({ transactions: [], count: 0, limit: 20, offset: 0 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const filtersResult = TransactionFiltersSchema.safeParse({
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    })

    if (!filtersResult.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid query parameters', {
          errors: filtersResult.error.errors,
        }),
        { status: 400 }
      )
    }

    const filters = filtersResult.data

    // Execute query for each property and combine results
    const repository = new SupabaseTransactionRepository(supabase)
    const queryHandler = new GetPropertyTransactionsQueryHandler(repository)

    const allTransactions = []
    for (const property of properties) {
      // Build filters object conditionally to satisfy exactOptionalPropertyTypes
      const queryFilters: {
        type?: TransactionType
        status?: TransactionStatus
        startDate?: Date
        endDate?: Date
        limit?: number
        offset?: number
      } = {
        limit: filters.limit,
        offset: filters.offset,
      }
      if (filters.type) {
        queryFilters.type = filters.type as TransactionType
      }
      if (filters.status) {
        queryFilters.status = filters.status as TransactionStatus
      }
      if (filters.startDate) {
        queryFilters.startDate = new Date(filters.startDate)
      }
      if (filters.endDate) {
        queryFilters.endDate = new Date(filters.endDate)
      }

      const transactions = await queryHandler.execute({
        propertyId: property.id,
        filters: queryFilters,
      })
      allTransactions.push(...transactions)
    }

    // Sort by createdAt descending and apply limit/offset
    allTransactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const paginatedTransactions = allTransactions.slice(
      filters.offset,
      filters.offset + filters.limit
    )

    // Convert to DTOs
    const transactionDTOs = paginatedTransactions.map(toTransactionDTO)

    return success({
      transactions: transactionDTOs,
      count: allTransactions.length,
      limit: filters.limit,
      offset: filters.offset,
    })
  } catch (err: unknown) {
    console.error('[Financial API v1] List transactions error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to list transactions', { message }),
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/financial/transactions
 *
 * Record a payment transaction for a reservation.
 */
export async function POST(request: NextRequest) {
  try {
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

    // Get user's company (BP-4: Multi-tenant isolation)
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

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest
    try {
      validatedRequest = RecordPaymentRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Verify reservation exists and belongs to company
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id, properties!inner(id, company_id)')
      .eq('id', validatedRequest.reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if ((reservation as any).properties.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - reservation belongs to different company'),
        { status: 403 }
      )
    }

    // Execute command using application layer
    const transactionRepository = new SupabaseTransactionRepository(supabase)
    const invoiceRepository = new SupabaseInvoiceRepository(supabase)
    const commandHandler = new RecordPaymentCommandHandler(
      transactionRepository,
      invoiceRepository
    )

    // Generate transaction ID
    const transactionId = crypto.randomUUID()

    const transaction = await commandHandler.execute({
      transactionId,
      propertyId: reservation.property_id,
      reservationId: validatedRequest.reservationId,
      invoiceId: validatedRequest.invoiceId ?? null,
      amountCents: validatedRequest.amountCents,
      paymentMethod: validatedRequest.paymentMethod as any,
      stripePaymentIntentId: validatedRequest.stripePaymentIntentId ?? null,
      notes: validatedRequest.notes ?? null,
      createdBy: user.id,
    })

    // Convert to DTO
    const transactionDTO = toTransactionDTO(transaction)

    // success() already returns a NextResponse - don't double-wrap with NextResponse.json()
    const response = success(transactionDTO)
    return new NextResponse(response.body, {
      status: 201,
      headers: response.headers,
    })
  } catch (err: any) {
    console.error('[Financial API v1] Record payment error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
