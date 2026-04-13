/**
 * Reservations API v1 - Modify Dates
 *
 * Phase 3A: Booking Engine Enhancements
 *
 * POST /api/v1/reservations/[id]/modify-dates - Modify reservation dates
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { ModifyReservationDatesRequestSchema,
  type ModifyReservationDatesRequest,
} from '@/types/api/v1/schemas/reservations'
import { ModifyReservationDatesCommandHandler } from '@/modules/BookingEngine/application/commands/ModifyReservationDatesCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { AvailabilityService } from '@/modules/BookingEngine/domain/services/AvailabilityService'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'

/**
 * POST /api/v1/reservations/[id]/modify-dates
 *
 * Modify the check-in and check-out dates of a reservation.
 * Validates availability and recalculates pricing.
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

    // RBAC: verify user has modify-dates access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: existingReservation.propertyId,
      minimumRole: 'manager',
      permission: 'reservations.modify_dates',
    })
    if (isDenied(access)) return access


    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: ModifyReservationDatesRequest
    try {
      validatedRequest = ModifyReservationDatesRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Execute command using application layer
    const availabilityService = new AvailabilityService(repository)
    const commandHandler = new ModifyReservationDatesCommandHandler(
      repository,
      availabilityService
    )

    const result = await commandHandler.execute({
      reservationId,
      newCheckIn: new Date(validatedRequest.newCheckIn),
      newCheckOut: new Date(validatedRequest.newCheckOut),
      newTotalAmountCents: validatedRequest.newTotalAmountCents,
    })

    // Handle result
    if (!result.success) {
      const statusCode =
        result.error === 'NOT_FOUND' ? 404 :
        result.error === 'NOT_MODIFIABLE' ? 409 :
        result.error === 'NOT_AVAILABLE' ? 409 :
        result.error === 'INVALID_DATES' ? 400 :
        500

      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.message),
        { status: statusCode }
      )
    }

    // Convert to DTO
    const reservationDTO = toReservationDTO(result.reservation)

    return success(reservationDTO)
  } catch (err: unknown) {
    console.error('[Reservations API v1] Modify dates error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to modify reservation dates', {
        message,
      }),
      { status: 500 }
    )
  }
}
