/**
 * Reservations API v1 - Confirm Reservation
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * POST /api/v1/reservations/[id]/confirm - Confirm reservation after payment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { ConfirmReservationCommandHandler } from '@/modules/BookingEngine/application/commands/ConfirmReservationCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { DefaultStrategyProvider } from '@/modules/BookingEngine/infrastructure/DefaultStrategyProvider'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'

/**
 * POST /api/v1/reservations/[id]/confirm
 *
 * Confirm a reservation after payment has been received.
 * Uses property-configured confirmation policy to validate payment requirements.
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

    // Create strategy provider (uses property's configured policies)
    const strategyProvider = new DefaultStrategyProvider()

    // Execute command using application layer
    const commandHandler = new ConfirmReservationCommandHandler(repository, strategyProvider)

    const result = await commandHandler.execute({
      reservationId,
      requestedBy: user.id,
    })

    // Handle result
    if (!result.success) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'INVALID_STATUS' ? 409
        : result.error.code === 'POLICY_VIOLATION' ? 400
        : 500

      return NextResponse.json(
        error(
          result.error.code === 'POLICY_VIOLATION' ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.INTERNAL_ERROR,
          result.error.message,
          {
            policyType: result.error.policyType,
            minimumRequired: result.error.minimumRequired,
          }
        ),
        { status: statusCode }
      )
    }

    // Convert to DTO
    const reservationDTO = toReservationDTO(result.reservation)

    return success(reservationDTO)
  } catch (err: unknown) {
    console.error('[Reservations API v1] Confirm error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to confirm reservation', {
        message,
      }),
      { status: 500 }
    )
  }
}
