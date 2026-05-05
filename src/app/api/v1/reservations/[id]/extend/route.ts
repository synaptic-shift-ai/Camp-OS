/**
 * Reservations API v1 - Extend Reservation
 *
 * Phase 3A: Booking Engine Enhancements
 *
 * POST /api/v1/reservations/[id]/extend - Extend reservation checkout date
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { canModifyReservationsModule } from '@/lib/dashboard/reservations-module-access'
import { ExtendReservationRequestSchema,
  type ExtendReservationRequest,
} from '@/types/api/v1/schemas/reservations'
import { ExtendReservationCommandHandler } from '@/modules/BookingEngine/application/commands/ExtendReservationCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { AvailabilityService } from '@/modules/BookingEngine/domain/services/AvailabilityService'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/v1/reservations/[id]/extend
 *
 * Extend a reservation's checkout date.
 * Validates availability for the extended period.
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

    // RBAC: verify user has extend access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: existingReservation.propertyId,
      permission: 'reservations.extend',
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

    let validatedRequest: ExtendReservationRequest
    try {
      validatedRequest = ExtendReservationRequestSchema.parse(body)
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
    const commandHandler = new ExtendReservationCommandHandler(
      repository,
      availabilityService
    )

    const result = await commandHandler.execute({
      reservationId,
      newCheckOutDate: new Date(validatedRequest.newCheckOutDate),
      additionalAmountCents: validatedRequest.additionalAmountCents,
    })

    // Handle result
    if (!result.success) {
      const statusCode =
        result.error === 'NOT_FOUND' ? 404 :
        result.error === 'NOT_MODIFIABLE' ? 409 :
        result.error === 'NOT_AVAILABLE' ? 409 :
        result.error === 'INVALID_EXTENSION' ? 400 :
        result.error === 'ALREADY_PAST' ? 400 :
        500

      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.message),
        { status: statusCode }
      )
    }

    if (access.companyId) {
      const supabaseServiceRole = createServiceRoleClient()
      const confirmationNumber = result.reservation.confirmationNumber.value
      await recordActivityLog(supabaseServiceRole, {
        companyId: access.companyId,
        propertyId: result.reservation.propertyId,
        action: 'extended',
        resource: 'reservation',
        userId: user.id,
        details: `Extended reservation (confirmation ${confirmationNumber})`,
      })
    }

    // Trigger automation pipeline directly (primary mechanism)
    try {
      const { triggerReservationAutomations } = await import('@/lib/automations/run-pipeline')
      // Fetch property company_id for automation context
      const { data: automationProperty } = await supabase
        .from('properties')
        .select('company_id')
        .eq('id', existingReservation.propertyId)
        .maybeSingle()

      if (automationProperty?.company_id) {
        await triggerReservationAutomations(
          'reservation.modified',
          reservationId,
          existingReservation.propertyId,
          automationProperty.company_id,
        )
      } else {
        console.warn('[Extend] Skipping automation: no company_id for property', existingReservation.propertyId)
      }
    } catch (pipelineError) {
      console.error('[Extend] Automation pipeline failed:', pipelineError)
      // Non-blocking — extension still succeeds
    }

    // Convert to DTO with additional info
    const reservationDTO = toReservationDTO(result.reservation)

    return success({
      reservation: reservationDTO,
      additionalNights: result.additionalNights,
    })
  } catch (err: unknown) {
    console.error('[Reservations API v1] Extend reservation error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to extend reservation', {
        message,
      }),
      { status: 500 }
    )
  }
}
