/**
 * Sites API v1 - Check Availability
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * GET /api/v1/sites/[siteId]/availability - Check if site is available for dates
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { CheckAvailabilityQuerySchema } from '@/types/api/v1/schemas/reservations'
import { CheckSiteAvailabilityQueryHandler } from '@/modules/BookingEngine/application/queries/CheckSiteAvailabilityQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'

/**
 * GET /api/v1/sites/[siteId]/availability
 *
 * Check if a site is available for a given date range.
 * Returns availability status and any conflicting reservations.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const supabase = await createClient()

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      checkIn: searchParams.get('checkIn'),
      checkOut: searchParams.get('checkOut'),
    }

    // Validate query parameters
    try {
      CheckAvailabilityQuerySchema.parse(queryParams)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid query parameters', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Verify site exists
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, property_id')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Site not found'),
        { status: 404 }
      )
    }

    // Execute query using application layer
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new CheckSiteAvailabilityQueryHandler(repository)

    const result = await queryHandler.execute({
      siteId,
      checkIn: new Date(queryParams.checkIn!),
      checkOut: new Date(queryParams.checkOut!),
    })

    // Format response
    const response = {
      siteId,
      isAvailable: result.isAvailable,
      conflictingReservations: result.conflictingReservations.map((reservation) => ({
        id: reservation.id,
        confirmationNumber: reservation.confirmationNumber.value,
        checkInDate: reservation.checkInDate.toISOString(),
        checkOutDate: reservation.checkOutDate.toISOString(),
        status: reservation.status,
      })),
    }

    return success(response)
  } catch (err: any) {
    console.error('[Sites API v1] Check availability error:', err)

    // Handle domain validation errors
    if (err.message.includes('date')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 400 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to check availability', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
