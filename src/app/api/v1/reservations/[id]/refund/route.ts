/**
 * Reservations API v1 - Issue Refund
 *
 * Phase 3A: Booking Engine Enhancements
 *
 * POST /api/v1/reservations/[id]/refund - Issue a refund for a reservation
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { canModifyReservationsModule } from '@/lib/dashboard/reservations-module-access'
import { IssueRefundRequestSchema,
  type IssueRefundRequest,
} from '@/types/api/v1/schemas/reservations'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'

/**
 * POST /api/v1/reservations/[id]/refund
 *
 * Issue a refund for a reservation.
 * Tracks refund history and updates payment status.
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
    const reservation = await queryHandler.execute({ id: reservationId })

    if (!reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // RBAC: verify user has refund access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.propertyId,
      minimumRole: 'admin',
      permission: 'reservations.refund',
    })
    if (isDenied(access)) return access

    const canModifyReservation = await canModifyReservationsModule(
      supabase,
      reservation.propertyId,
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

    let validatedRequest: IssueRefundRequest
    try {
      validatedRequest = IssueRefundRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Check if refund can be issued
    if (!reservation.canIssueRefund()) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Cannot issue refund for this reservation'),
        { status: 409 }
      )
    }

    // Check if refund amount is valid
    const refundAmount = MoneyAmount.create(validatedRequest.amountCents)
    const maxRefundable = reservation.maxRefundableAmount

    if (refundAmount.isGreaterThan(maxRefundable)) {
      return NextResponse.json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          `Refund amount exceeds maximum refundable amount of ${maxRefundable.formatAsDollars()}`,
          { maxRefundableCents: maxRefundable.amountInCents }
        ),
        { status: 400 }
      )
    }

    // Issue the refund
    try {
      reservation.issueRefund(
        refundAmount,
        validatedRequest.reason,
        user.id,
        validatedRequest.notes ?? null
      )
    } catch (domainError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, domainError.message),
        { status: 400 }
      )
    }

    // Save updated reservation
    await repository.save(reservation)

    // Clear domain events
    reservation.clearDomainEvents()

    type RefundEmailRow = {
      guest: { first_name: string; last_name: string; email: string }
      property: { name: string }
    }

    const { data: rowData, error: rowError } = await supabase
      .from('reservations')
      .select('guest:guests(first_name, last_name, email), property:properties(name)')
      .eq('id', reservationId)
      .single()

    const row = rowData as RefundEmailRow | null

    if (!rowError && row?.guest && row?.property) {
      // Email is handled by automation pipeline only (no direct fallback)
    }

    if (access.companyId) {
      const supabaseServiceRole = createServiceRoleClient()
      const confirmationNumber = reservation.confirmationNumber.value
      await recordActivityLog(supabaseServiceRole, {
        companyId: access.companyId,
        propertyId: reservation.propertyId,
        action: 'refund_issued',
        resource: 'reservation',
        userId: user.id,
        details: `Issued refund for reservation (confirmation ${confirmationNumber})`,
      })
    }

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    // Trigger automation pipeline directly (primary mechanism)
    try {
      const { triggerReservationAutomations } = await import('@/lib/automations/run-pipeline')
      await triggerReservationAutomations(
        'refund.processed',
        reservationId,
        reservation.propertyId,
        access.companyId!,
      )
    } catch (pipelineError) {
      console.error('[Refund] Automation pipeline failed:', pipelineError)
      // Non-blocking — refund still succeeds
    }

    return success(reservationDTO)
  } catch (err: unknown) {
    console.error('[Reservations API v1] Issue refund error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to issue refund', {
        message,
      }),
      { status: 500 }
    )
  }
}
