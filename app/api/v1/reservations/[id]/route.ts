/**
 * Reservations API v1 - Get by ID
 *
 * Phase 2, Week 9-10: Booking Engine Module
 *
 * GET /api/v1/reservations/[id] - Get single reservation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ERROR_CODES } from '@/lib/api/errors'
import { GetReservationQueryHandler } from '@/modules/BookingEngine/application/queries/GetReservationQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'

/**
 * GET /api/v1/reservations/[id]
 *
 * Get a single reservation by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Execute query using application layer
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new GetReservationQueryHandler(repository)

    const reservation = await queryHandler.execute({ id })

    if (!reservation) {
      return NextResponse.json(
        error(ERROR_CODES.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    // Check if property belongs to user's company
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', reservation.propertyId)
      .single()

    if (propertyError || !property || property.company_id !== company.id) {
      return NextResponse.json(
        error(ERROR_CODES.AUTH_003, 'Forbidden - reservation belongs to different company'),
        { status: 403 }
      )
    }

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    return NextResponse.json(success(reservationDTO))
  } catch (err: any) {
    console.error('[Reservations API v1] GET by ID error:', err)
    return NextResponse.json(
      error(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch reservation', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
