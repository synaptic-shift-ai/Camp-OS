/**
 * Reservations API v1 - Check In
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * POST /api/v1/reservations/[id]/check-in - Check in guest for reservation
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  CheckInRequestSchema,
  type CheckInRequest,
} from '@/types/api/v1/schemas/reservations'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { CheckInGuestCommandHandler } from '@/modules/BookingEngine/application/commands/CheckInGuestCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { asYyyyMmDd, dayOfWeekFromYyyyMmDd } from '@/lib/utils'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/v1/reservations/[id]/check-in
 *
 * Check in a guest for their reservation.
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

    // RBAC: verify user has check-in access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: existingReservation.propertyId,
      minimumRole: 'staff',
      permission: 'reservations.check_in',
    })
    if (isDenied(access)) return access

    // Fetch property for booking rules
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id, booking_rules_config')
      .eq('id', existingReservation.propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Booking rules for check-in day restrictions
    const todayStr = asYyyyMmDd(new Date())
    const reservationStartStr = asYyyyMmDd(existingReservation.checkInDate)

    const bookingRulesConfig = (property as any)?.booking_rules_config
    const blackoutDates: string[] = Array.isArray(bookingRulesConfig?.blackout_dates)
      ? bookingRulesConfig.blackout_dates
      : []
    const allowedCheckInDays: string[] = Array.isArray(bookingRulesConfig?.allowed_checkin_days)
      ? bookingRulesConfig.allowed_checkin_days
      : []

    if (blackoutDates.includes(todayStr) && reservationStartStr === todayStr) {
      return NextResponse.json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          `Check-in is not allowed on ${todayStr} due to blackout date restrictions.`,
          { code: 'BLACKOUT_DATE' }
        ),
        { status: 400 }
      )
    }

    const todayDay = dayOfWeekFromYyyyMmDd(todayStr)
    const isAllowedCheckInDay = allowedCheckInDays.length === 0 || allowedCheckInDays.includes(todayDay)

    if (!isAllowedCheckInDay && reservationStartStr <= todayStr) {
      return NextResponse.json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          `Check-in is not allowed on ${todayStr} due to check-in day restrictions.`,
          { code: 'CHECKIN_DAY_NOT_ALLOWED' }
        ),
        { status: 400 }
      )
    }

    const { data: siteRow, error: siteLookupError } = await supabase
      .from('sites')
      .select('id, status, site_number')
      .eq('id', existingReservation.siteId)
      .eq('property_id', existingReservation.propertyId)
      .is('deleted_at', null)
      .maybeSingle()

    if (siteLookupError || !siteRow) {
      return error(
        ErrorCodes.RESOURCE_NOT_FOUND.code,
        'Site not found for this reservation',
        ErrorCodes.RESOURCE_NOT_FOUND.status
      )
    }

    if (siteRow.status === 'housekeeping') {
      return error(
        ErrorCodes.RESOURCE_004.code,
        'Cannot check in while the site is in housekeeping. Complete housekeeping first.',
        ErrorCodes.RESOURCE_004.status,
        undefined,
        { code: 'SITE_HOUSEKEEPING' }
      )
    }

    const { data: activeSiteStay, error: activeSiteStayError } = await supabase
      .from('reservations')
      .select('id, confirmation_number, check_out_date')
      .eq('property_id', existingReservation.propertyId)
      .eq('site_id', existingReservation.siteId)
      .eq('status', 'checked_in')
      .neq('id', reservationId)
      .limit(1)
      .maybeSingle()

    if (activeSiteStayError) {
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to validate site occupancy'),
        { status: 500 }
      )
    }

    if (activeSiteStay) {
      return error(
        ErrorCodes.RESOURCE_004.code,
        'A guest is currently checked in to this site. Please check them out before checking in this reservation.',
        409,
        request,
        { code: 'SITE_OCCUPIED' }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: CheckInRequest
    try {
      validatedRequest = CheckInRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Execute command using application layer
    const commandHandler = new CheckInGuestCommandHandler(repository)

    const reservation = await commandHandler.execute({
      reservationId,
      staffUserId: user.id, // Current authenticated user is performing check-in
      balancePaidCents: validatedRequest.balancePaidCents,
      notes: validatedRequest.notes ?? null,
    })

    if (reservation.siteId) {
      const { error: siteUpdateError } = await supabase
        .from('sites')
        .update({
          status: 'occupied',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservation.siteId)
        .eq('property_id', reservation.propertyId)

      if (siteUpdateError) {
        console.error('[Reservations API v1] Site occupied status update error:', siteUpdateError)
        return error(
          ErrorCodes.INTERNAL_ERROR.code,
          'Guest was checked in but failed to update site status',
          ErrorCodes.INTERNAL_ERROR.status
        )
      }

      if (access.companyId) {
        const supabaseServiceRole = createServiceRoleClient()
        await recordActivityLog(supabaseServiceRole, {
          companyId: access.companyId,
          propertyId: reservation.propertyId,
          action: 'update',
          resource: 'site',
          userId: null,
          details: `Site (number: ${siteRow.site_number}) marked as occupied`,
        })
      }
    }

    if (access.companyId) {
      const supabaseServiceRole = createServiceRoleClient()
      const confirmationNumber = reservation.confirmationNumber.value
      await recordActivityLog(supabaseServiceRole, {
        companyId: access.companyId,
        propertyId: reservation.propertyId,
        action: 'checked_in',
        resource: 'reservation',
        userId: user.id,
        details: `Checked in guest (confirmation ${confirmationNumber})`,
      })
    }

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    return success(reservationDTO)
  } catch (err: any) {
    console.error('[Reservations API v1] Check-in error:', err)

    // Handle domain validation errors
    if (err.message.includes('confirmed') || err.message.includes('check-in date')) {
      return error('VALIDATION_ERROR', err.message, 400)
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to check in guest', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
