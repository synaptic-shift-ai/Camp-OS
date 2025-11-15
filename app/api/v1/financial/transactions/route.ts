/**
 * Financial API v1 - Transactions
 *
 * POST /api/v1/financial/transactions - Record a payment transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ERROR_CODES } from '@/lib/api/errors'
import { RecordPaymentRequestSchema } from '@/types/api/v1/schemas/financial'
import { RecordPaymentCommandHandler } from '@/modules/Financial/application/commands/RecordPaymentCommand'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { SupabaseInvoiceRepository } from '@/modules/Financial/infrastructure/SupabaseInvoiceRepository'
import { toTransactionDTO } from '@/modules/Financial/application/DTOs/TransactionDTO'

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
        error(ERROR_CODES.AUTH_001, 'Unauthorized'),
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
        error(ERROR_CODES.RESOURCE_NOT_FOUND, 'Company not found'),
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
        error(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', {
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
        error(ERROR_CODES.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if (reservation.properties.company_id !== company.id) {
      return NextResponse.json(
        error(ERROR_CODES.AUTH_003, 'Forbidden - reservation belongs to different company'),
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
      invoiceId: validatedRequest.invoiceId,
      amountCents: validatedRequest.amountCents,
      paymentMethod: validatedRequest.paymentMethod,
      stripePaymentIntentId: validatedRequest.stripePaymentIntentId,
      notes: validatedRequest.notes,
      createdBy: user.id,
    })

    // Convert to DTO
    const transactionDTO = toTransactionDTO(transaction)

    return NextResponse.json(success(transactionDTO), { status: 201 })
  } catch (err: any) {
    console.error('[Financial API v1] Record payment error:', err)

    return NextResponse.json(
      error(ERROR_CODES.INTERNAL_ERROR, 'Failed to record payment', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
