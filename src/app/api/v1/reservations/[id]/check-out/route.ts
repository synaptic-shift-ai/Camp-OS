/**
 * Reservations API v1 - Check Out
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * POST /api/v1/reservations/[id]/check-out - Check out guest for reservation
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  CheckOutRequestSchema,
  type CheckOutRequest,
} from '@/types/api/v1/schemas/reservations'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { CheckOutGuestCommandHandler } from '@/modules/BookingEngine/application/commands/CheckOutGuestCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { asYyyyMmDd, dayOfWeekFromYyyyMmDd } from '@/lib/utils'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/v1/reservations/[id]/check-out
 *
 * Check out a guest from their reservation.
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

    // RBAC: Staff Access "Check-out guests" (reservations.check_out)
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: existingReservation.propertyId,
      permission: 'reservations.check_out',
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

    // Booking rules for check-out day restrictions
    const todayStr = asYyyyMmDd(new Date())
    const reservationEndStr = asYyyyMmDd(existingReservation.checkOutDate)

    const bookingRulesConfig = (property as any)?.booking_rules_config
    const allowedCheckOutDays: string[] = Array.isArray(bookingRulesConfig?.allowed_checkout_days)
      ? bookingRulesConfig.allowed_checkout_days
      : []

    const todayDay = dayOfWeekFromYyyyMmDd(todayStr)
    const isAllowedCheckOutDay = allowedCheckOutDays.length === 0 || allowedCheckOutDays.includes(todayDay)

    if (!isAllowedCheckOutDay && reservationEndStr >= todayStr) {
      return NextResponse.json(
        error(
          ErrorCodes.VALIDATION_ERROR,
          `Check-out is not allowed on ${todayStr} due to check-out day restrictions.`,
          { code: 'CHECKOUT_DAY_NOT_ALLOWED' }
        ),
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: CheckOutRequest
    try {
      validatedRequest = CheckOutRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Execute command using application layer
    const commandHandler = new CheckOutGuestCommandHandler(repository)

    const reservation = await commandHandler.execute({
      reservationId,
      staffUserId: user.id, // Current authenticated user is performing check-out
      hasDamages: validatedRequest.hasDamages,
      notes: validatedRequest.notes ?? null,
    })

    // After check-out the site needs turnover to housekeeping
    if (reservation.siteId) {
      const { data: siteRow, error: siteLookupError } = await supabase
        .from('sites')
        .select('id, site_number')
        .eq('id', reservation.siteId)
        .eq('property_id', reservation.propertyId)
        .is('deleted_at', null)
        .maybeSingle()

      if (siteLookupError || !siteRow) {
        return NextResponse.json(
          error(ErrorCodes.RESOURCE_NOT_FOUND, 'Site not found for this reservation'),
          { status: 404 }
        )
      }

      const { error: siteUpdateError } = await supabase
        .from('sites')
        .update({
          status: 'housekeeping',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservation.siteId)
        .eq('property_id', reservation.propertyId)

      if (siteUpdateError) {
        console.error('[Reservations API v1] Site housekeeping status update error:', siteUpdateError)
        return NextResponse.json(
          error(ErrorCodes.INTERNAL_ERROR, 'Guest was checked out but failed to update site status'),
          { status: 500 }
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
          details: `Site (number: ${siteRow.site_number}) marked as housekeeping`,
        })
      }
    }

    if (access.companyId) {
      const supabaseServiceRole = createServiceRoleClient()
      const confirmationNumber = reservation.confirmationNumber.value
      await recordActivityLog(supabaseServiceRole, {
        companyId: access.companyId,
        propertyId: reservation.propertyId,
        action: 'checked_out',
        resource: 'reservation',
        userId: user.id,
        details: `Checked out guest (confirmation ${confirmationNumber})`,
      })
    }

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    return success(reservationDTO)
  } catch (err: any) {
    console.error('[Reservations API v1] Check-out error:', err)

    // Handle domain validation errors
    if (err.message.includes('checked in')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 409 }
      )
    }

    if (err.message.includes('check-out date')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 400 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to check out guest', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
