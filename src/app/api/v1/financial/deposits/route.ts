/**
 * Financial API v1 - Security Deposits
 *
 * POST /api/v1/financial/deposits - Hold a security deposit
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
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
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest
    try {
      validatedRequest = HoldSecurityDepositRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Verify reservation exists
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id')
      .eq('id', validatedRequest.reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // RBAC: verify user has transaction view access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.property_id,
      minimumRole: 'manager',
      permission: 'financial.view_transactions',
    })
    if (isDenied(access)) return access


    // Execute command
    const depositRepository = new SupabaseSecurityDepositRepository(supabase)
    const commandHandler = new HoldSecurityDepositCommandHandler(depositRepository)

    const depositId = crypto.randomUUID()

    const deposit = await commandHandler.execute({
      depositId,
      propertyId: reservation.property_id,
      reservationId: validatedRequest.reservationId,
      amountCents: validatedRequest.amountCents,
      stripePaymentIntentId: validatedRequest.stripePaymentIntentId ?? null,
    })

    // Convert to DTO
    const depositDTO = toSecurityDepositDTO(deposit)

    // success() already returns a NextResponse - don't double-wrap with NextResponse.json()
    const response = success(depositDTO)
    return new NextResponse(response.body, {
      status: 201,
      headers: response.headers,
    })
  } catch (err: any) {
    console.error('[Financial API v1] Hold deposit error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to hold security deposit', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
