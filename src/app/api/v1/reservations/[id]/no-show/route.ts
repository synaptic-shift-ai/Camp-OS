/**
 * Reservations API v1 - Mark No Show
 *
 * Phase 3A: Booking Engine Enhancements
 *
 * POST /api/v1/reservations/[id]/no-show - Mark reservation as no-show
 */

import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MarkNoShowCommandHandler } from '@/modules/BookingEngine/application/commands/MarkNoShowCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'

/**
 * POST /api/v1/reservations/[id]/no-show
 *
 * Mark a reservation as no-show when a guest fails to arrive.
 * Only confirmed reservations can be marked as no-show.
 */
export async function POST(
  _request: NextRequest,
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

    // Verify reservation exists and belongs to company
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new GetReservationQueryHandler(repository)
    const existingReservation = await queryHandler.execute({ id: reservationId })

    if (!existingReservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', existingReservation.propertyId)
      .single()

    if (propertyError || !property || property.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - reservation belongs to different company'),
        { status: 403 }
      )
    }

    // Execute command using application layer
    const commandHandler = new MarkNoShowCommandHandler(repository)

    const result = await commandHandler.execute({
      reservationId,
      staffUserId: user.id,
    })

    // Handle result
    if (!result.success) {
      const statusCode =
        result.error === 'NOT_FOUND' ? 404 :
        result.error === 'INVALID_STATUS' ? 409 :
        500

      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.message),
        { status: statusCode }
      )
    }

    revalidatePath('/dashboard/reservations')

    // Convert to DTO
    const reservationDTO = toReservationDTO(result.reservation)

    return success(reservationDTO)
  } catch (err: unknown) {
    console.error('[Reservations API v1] Mark no-show error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to mark reservation as no-show', {
        message,
      }),
      { status: 500 }
    )
  }
}
