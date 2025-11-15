/**
 * Financial API v1 - Security Deposits
 *
 * POST /api/v1/financial/deposits - Hold a security deposit
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ERROR_CODES } from '@/lib/api/errors'
import { HoldSecurityDepositRequestSchema } from '@/types/api/v1/schemas/financial'
import { HoldSecurityDepositCommandHandler } from '@/modules/Financial/application/commands/HoldSecurityDepositCommand'
import { SupabaseSecurityDepositRepository } from '@/modules/Financial/infrastructure/SupabaseSecurityDepositRepository'
import { toSecurityDepositDTO } from '@/modules/Financial/application/DTOs/SecurityDepositDTO'

/**
 * POST /api/v1/financial/deposits
 *
 * Hold a security deposit for a reservation.
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

    // Get user's company
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
      validatedRequest = HoldSecurityDepositRequestSchema.parse(body)
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

    // Execute command
    const depositRepository = new SupabaseSecurityDepositRepository(supabase)
    const commandHandler = new HoldSecurityDepositCommandHandler(depositRepository)

    const depositId = crypto.randomUUID()

    const deposit = await commandHandler.execute({
      depositId,
      propertyId: reservation.property_id,
      reservationId: validatedRequest.reservationId,
      amountCents: validatedRequest.amountCents,
      stripePaymentIntentId: validatedRequest.stripePaymentIntentId,
    })

    // Convert to DTO
    const depositDTO = toSecurityDepositDTO(deposit)

    return NextResponse.json(success(depositDTO), { status: 201 })
  } catch (err: any) {
    console.error('[Financial API v1] Hold deposit error:', err)

    return NextResponse.json(
      error(ERROR_CODES.INTERNAL_ERROR, 'Failed to hold security deposit', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
