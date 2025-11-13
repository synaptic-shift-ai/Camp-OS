/**
 * Reservations API v1 - Record Payment
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * POST /api/v1/reservations/[id]/payment - Record payment for reservation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ERROR_CODES } from '@/lib/api/errors'
import {
  RecordPaymentRequestSchema,
  type RecordPaymentRequest,
} from '@/types/api/v1/schemas/reservations'
import { RecordPaymentCommandHandler } from '@/modules/BookingEngine/application/commands/RecordPaymentCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'

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

    // Verify reservation exists and belongs to company
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new GetReservationQueryHandler(repository)
    const existingReservation = await queryHandler.execute({ id: reservationId })

    if (!existingReservation) {
      return NextResponse.json(
        error(ERROR_CODES.RESOURCE_NOT_FOUND, 'Reservation not found'),
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
        error(ERROR_CODES.AUTH_003, 'Forbidden - reservation belongs to different company'),
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: RecordPaymentRequest
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

    // Execute command using application layer
    const commandHandler = new RecordPaymentCommandHandler(repository)

    const reservation = await commandHandler.execute({
      reservationId,
      amountCents: validatedRequest.amountCents,
      paymentMethod: validatedRequest.paymentMethod,
      stripePaymentIntentId: validatedRequest.stripePaymentIntentId,
    })

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    return NextResponse.json(success(reservationDTO))
  } catch (err: any) {
    console.error('[Reservations API v1] Record payment error:', err)

    // Handle domain validation errors
    if (err.message.includes('exceeds')) {
      return NextResponse.json(
        error(ERROR_CODES.VALIDATION_ERROR, err.message),
        { status: 400 }
      )
    }

    if (err.message.includes('cancelled')) {
      return NextResponse.json(
        error(ERROR_CODES.VALIDATION_ERROR, err.message),
        { status: 409 }
      )
    }

    return NextResponse.json(
      error(ERROR_CODES.INTERNAL_ERROR, 'Failed to record payment', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
