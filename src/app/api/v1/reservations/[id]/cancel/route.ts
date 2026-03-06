/**
 * Reservations API v1 - Cancel Reservation
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * POST /api/v1/reservations/[id]/cancel - Cancel reservation with refund
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  CancelReservationRequestSchema,
  type CancelReservationRequest,
} from '@/types/api/v1/schemas/reservations'
import { CancelReservationCommandHandler } from '@/modules/BookingEngine/application/commands/CancelReservationCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { computeRefundCentsFromCancellationPolicy } from '@/modules/BookingEngine/domain/services/CancellationPolicyRefundCalculator'
import { PropertySettings } from '@/modules/PropertyManagement/domain/PropertySettings'

/**
 * POST /api/v1/reservations/[id]/cancel
 *
 * Cancel a reservation and process refund if applicable.
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
      .select('id, company_id, settings')
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

    let validatedRequest: CancelReservationRequest
    try {
      validatedRequest = CancelReservationRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Apply cancellation policy to property settings
    const settings = PropertySettings.fromJson(property.settings ?? null)
    const policy = {
      freeCancellationWindow: settings.freeCancellationWindow,
      refundEligiblePeriod: settings.refundEligiblePeriod,
      cancellationRefundPercentage: settings.cancellationRefundPercentage,
      cancellationNonRefundableDays: settings.cancellationNonRefundableDays,
    }

    const paidCents = existingReservation.paidAmount.amountInCents
    const totalCents = existingReservation.totalAmount.amountInCents
    const policyRefundCents = computeRefundCentsFromCancellationPolicy(
      existingReservation.checkInDate,
      new Date(),
      paidCents,
      policy,
    )
    const effectivePolicyRefundCents =
      policyRefundCents === 0 && paidCents > 0 && paidCents < totalCents
        ? paidCents
        : policyRefundCents
    const refundAmountCents = Math.min(
      validatedRequest.refundAmountCents,
      effectivePolicyRefundCents
    )

    // Execute command using application layer
    const commandHandler = new CancelReservationCommandHandler(repository)

    const reservation = await commandHandler.execute({
      reservationId,
      reason: validatedRequest.reason ?? null,
      refundAmountCents,
    })

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    return success(reservationDTO)
  } catch (err: any) {
    console.error('[Reservations API v1] Cancel error:', err)

    // Handle domain validation errors
    if (err.message.includes('already cancelled')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 409 }
      )
    }

    if (err.message.includes('exceeds')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 400 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to cancel reservation', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
