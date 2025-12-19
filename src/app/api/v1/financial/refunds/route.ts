/**
 * Financial API v1 - Refunds
 *
 * Phase 4C: API Consolidation
 *
 * POST /api/v1/financial/refunds - Process a refund
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { ProcessRefundRequestSchema } from '@/types/api/v1/schemas/financial'
import { ProcessRefundCommandHandler } from '@/modules/Financial/application/commands/ProcessRefundCommand'
import { SupabaseTransactionRepository } from '@/modules/Financial/infrastructure/SupabaseTransactionRepository'
import { toTransactionDTO } from '@/modules/Financial/application/DTOs/TransactionDTO'
import { PaymentMethod } from '@/modules/Financial'

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

    // 2. Get user's company (BP-4: Multi-tenant isolation)
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

    // 3. Parse and validate request body
    const body = await request.json()
    const validated = ProcessRefundRequestSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 }
      )
    }

    // 4. Verify reservation exists and belongs to company
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id, properties!inner(id, company_id)')
      .eq('id', validated.data.reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // 5. Verify tenant access (BP-4)
    if ((reservation as any).properties.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - reservation belongs to different company'),
        { status: 403 }
      )
    }

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

    // 7. Convert to DTO and return
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
