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
import { CheckOutGuestCommandHandler } from '@/modules/BookingEngine/application/commands/CheckOutGuestCommand'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'
import { asYyyyMmDd, dayOfWeekFromYyyyMmDd } from '@/lib/utils'

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
      .select('id, company_id, booking_rules_config')
      .eq('id', existingReservation.propertyId)
      .single()

    if (propertyError || !property || property.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - reservation belongs to different company'),
        { status: 403 }
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

    // If damages were reported during check-out, move site to maintenance.
    if (validatedRequest.hasDamages && reservation.siteId) {
      const { error: siteUpdateError } = await supabase
        .from('sites')
        .update({
          status: 'maintenance',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservation.siteId)
        .eq('property_id', reservation.propertyId)

      if (siteUpdateError) {
        console.error('[Reservations API v1] Site maintenance update error:', siteUpdateError)
        return NextResponse.json(
          error(ErrorCodes.INTERNAL_ERROR, 'Guest was checked out but failed to update site status'),
          { status: 500 }
        )
      }
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
