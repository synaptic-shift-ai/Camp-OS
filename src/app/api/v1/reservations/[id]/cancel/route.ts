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
import { sendCancellationNotice } from '@/lib/email/send'

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

    type CancellationEmailRow = {
      guest: { first_name: string; last_name: string; email: string }
      property: { name: string }
      site: { site_name: string; site_number: string }
    }

    const { data: rowData, error: rowError } = await supabase
      .from('reservations')
      .select(
        'guest:guests(first_name, last_name, email), property:properties(name), site:sites(site_name, site_number)'
      )
      .eq('id', reservationId)
      .single()

    const reservationRow = rowData as CancellationEmailRow | null

    if (!rowError && reservationRow?.guest && reservationRow?.property && reservationRow?.site) {
      const guest = reservationRow.guest as { first_name: string; last_name: string; email: string }
      const propertyRow = reservationRow.property as { name: string }
      const siteRow = reservationRow.site as { site_name: string; site_number: string }
      const guestName = `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || 'Guest'
      const siteName = siteRow?.site_name ?? (siteRow?.site_number != null ? `Site ${siteRow.site_number}` : 'Site')

      const refundStatus: 'processing' | 'completed' | 'none' =
        refundAmountCents === 0 
          ? 'none' 
          : refundAmountCents >= paidCents
            ? 'completed'
            : 'processing'

      sendCancellationNotice({
        guestName,
        guestEmail: guest.email,
        confirmationNumber: reservation.confirmationNumber.value,
        propertyName: propertyRow.name,
        siteName,
        checkInDate: reservation.checkInDate.toISOString(),
        checkOutDate: reservation.checkOutDate.toISOString(),
        cancellationDate: new Date().toISOString(),
        ...(validatedRequest.reason ? { cancellationReason: validatedRequest.reason } : {}),
        ...(refundAmountCents > 0 ? { refundAmount: refundAmountCents } : {}),
        ...(validatedRequest.refundPaymentMethod ? { refundPaymentMethod: validatedRequest.refundPaymentMethod } : {}),
        refundStatus,
      }).catch((err) => {
        console.error('[Reservation API v1] Failed to send cancellation notice:', err)
      })
    }

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
