/**
 * Reservations API v1 - Record Payment
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * POST /api/v1/reservations/[id]/payment - Record payment for reservation
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  RecordPaymentRequestSchema,
  type RecordPaymentRequest,
} from '@/types/api/v1/schemas/reservations'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { canModifyReservationsModule } from '@/lib/dashboard/reservations-module-access'
import { RecordPaymentCommandHandler } from '@/modules/BookingEngine/application/commands/RecordPaymentCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/v1/reservations/[id]/payment
 *
 * Record a payment for a reservation.
 */
export async function POST(
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
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new GetReservationQueryHandler(repository)
    const existingReservation = await queryHandler.execute({ id: reservationId })

    if (!existingReservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // RBAC: verify user has payment recording access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: existingReservation.propertyId,
      minimumRole: 'staff',
      permission: 'financial.record_payment',
    })
    if (isDenied(access)) return access

    const canModifyReservation = await canModifyReservationsModule(
      supabase,
      existingReservation.propertyId,
      user.id,
    )
    if (!canModifyReservation) {
      return error(
        ErrorCodes.AUTH_006.code,
        'You do not have permission to modify the reservation',
        ErrorCodes.AUTH_006.status,
        request,
      )
    }


    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: RecordPaymentRequest
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

    // Execute command using application layer
    const commandHandler = new RecordPaymentCommandHandler(repository)

    const reservation = await commandHandler.execute({
      reservationId,
      amountCents: validatedRequest.amountCents,
      paymentMethod: validatedRequest.paymentMethod,
      stripePaymentIntentId: validatedRequest.stripePaymentIntentId ?? null,
    })

    if (access.companyId) {
      const supabaseServiceRole = createServiceRoleClient()
      const confirmationNumber = reservation.confirmationNumber.value
      await recordActivityLog(supabaseServiceRole, {
        companyId: access.companyId,
        propertyId: reservation.propertyId,
        action: 'manual_payment',
        resource: 'reservation',
        userId: user.id,
        details: `Recorded manual payment for reservation (confirmation ${confirmationNumber})`,
      })
    }

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    return success(reservationDTO)
  } catch (err: any) {
    console.error('[Reservations API v1] Record payment error:', err)

    // Handle domain validation errors
    if (err.message.includes('exceeds')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 400 }
      )
    }

    if (err.message.includes('cancelled')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 409 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
