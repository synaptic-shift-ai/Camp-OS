/**
 * Reservations API v1 - Renew Reservation
 *
 * Phase 3A: Booking Engine Enhancements
 *
 * POST /api/v1/reservations/[id]/renew - Renew reservation for an additional period
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  RenewReservationRequestSchema,
  type RenewReservationRequest,
} from '@/types/api/v1/schemas/reservations'
import { RenewReservationCommandHandler } from '@/modules/BookingEngine/application/commands/RenewReservationCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { AvailabilityService } from '@/modules/BookingEngine/domain/services/AvailabilityService'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'

/**
 * POST /api/v1/reservations/[id]/renew
 *
 * Create a linked renewal reservation that continues from the current checkout date.
 * Used for long-term stays (weekly, monthly, seasonal).
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

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: RenewReservationRequest
    try {
      validatedRequest = RenewReservationRequestSchema.parse(body)
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
    const commandHandler = new RenewReservationCommandHandler(
      repository,
      availabilityService
    )

    const result = await commandHandler.execute({
      originalReservationId: reservationId,
      renewalPeriod: validatedRequest.renewalPeriod,
      ...(validatedRequest.customNights !== undefined && {
        customNights: validatedRequest.customNights,
      }),
      totalAmountCents: validatedRequest.totalAmountCents,
      specialRequests: validatedRequest.specialRequests ?? null,
    })

    // Handle result
    if (!result.success) {
      const statusCode =
        result.error === 'NOT_FOUND' ? 404 :
        result.error === 'INVALID_STATUS' ? 409 :
        result.error === 'NOT_AVAILABLE' ? 409 :
        result.error === 'INVALID_PERIOD' ? 400 :
        500

      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.message),
        { status: statusCode }
      )
    }

    // Convert to DTOs
    const originalReservationDTO = toReservationDTO(result.originalReservation)
    const renewalReservationDTO = toReservationDTO(result.renewalReservation)

    return success({
      originalReservation: originalReservationDTO,
      renewalReservation: renewalReservationDTO,
      renewalNights: result.renewalNights,
    })
  } catch (err: unknown) {
    console.error('[Reservations API v1] Renew reservation error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to renew reservation', {
        message,
      }),
      { status: 500 }
    )
  }
}
