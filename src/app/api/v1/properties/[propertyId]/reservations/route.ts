/**
 * Reservations API v1 - Create and List by Property
 *
 * Phase 2, Week 9-10: Booking Engine Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * POST /api/v1/properties/[propertyId]/reservations - Create reservation
 * GET /api/v1/properties/[propertyId]/reservations - List reservations with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  CreateReservationRequestSchema,
  type CreateReservationRequest,
  ListReservationsQuerySchema,
} from '@/types/api/v1/schemas/reservations'
import { CreateReservationCommandHandler } from '@/modules/BookingEngine/application/commands/CreateReservationCommand'
import { ListReservationsQueryHandler } from '@/modules/BookingEngine/application/queries/ListReservationsQuery'
import { SupabaseReservationRepository } from '@/modules/BookingEngine/infrastructure/SupabaseReservationRepository'
import { toReservationDTO } from '@/modules/BookingEngine/application/DTOs/ReservationDTO'

/**
 * POST /api/v1/properties/[propertyId]/reservations
 *
 * Create a new reservation for a property.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
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

    // Verify property belongs to company
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .eq('company_id', company.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property not found or access denied'),
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: CreateReservationRequest
    try {
      validatedRequest = CreateReservationRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Execute command using application layer
    const repository = new SupabaseReservationRepository(supabase)
    const commandHandler = new CreateReservationCommandHandler(repository)

    const reservation = await commandHandler.execute({
      propertyId,
      siteId: validatedRequest.siteId,
      guestId: validatedRequest.guestId,
      checkIn: new Date(validatedRequest.checkIn),
      checkOut: new Date(validatedRequest.checkOut),
      occupancy: validatedRequest.occupancy,
      totalAmountCents: validatedRequest.totalAmountCents,
      specialRequests: validatedRequest.specialRequests ?? null,
      source: validatedRequest.source,
    })

    // Convert to DTO
    const reservationDTO = toReservationDTO(reservation)

    return NextResponse.json(success(reservationDTO), { status: 201 })
  } catch (err: any) {
    console.error('[Reservations API v1] POST error:', err)

    // Handle domain validation errors
    if (err.message.includes('not available')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 409 }
      )
    }

    if (err.message.includes('past dates')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 400 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to create reservation', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/properties/[propertyId]/reservations
 *
 * List reservations for a property with optional filters.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
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

    // Verify property belongs to company
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .eq('company_id', company.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property not found or access denied'),
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      status: searchParams.get('status') || undefined,
      guestId: searchParams.get('guestId') || undefined,
      siteId: searchParams.get('siteId') || undefined,
      checkInFrom: searchParams.get('checkInFrom') || undefined,
      checkInTo: searchParams.get('checkInTo') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    }

    // Validate query parameters
    try {
      ListReservationsQuerySchema.parse(queryParams)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid query parameters', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Execute query using application layer
    const repository = new SupabaseReservationRepository(supabase)
    const queryHandler = new ListReservationsQueryHandler(repository)

    const result = await queryHandler.execute({
      propertyId,
      ...(queryParams.status !== undefined && { status: queryParams.status as any }),
      ...(queryParams.guestId !== undefined && { guestId: queryParams.guestId }),
      ...(queryParams.siteId !== undefined && { siteId: queryParams.siteId }),
      ...(queryParams.checkInFrom !== undefined && { checkInFrom: new Date(queryParams.checkInFrom) }),
      ...(queryParams.checkInTo !== undefined && { checkInTo: new Date(queryParams.checkInTo) }),
      ...(queryParams.limit !== undefined && { limit: queryParams.limit }),
      offset: queryParams.offset,
    })

    // Convert to DTOs
    const reservationsDTO = result.reservations.map(toReservationDTO)

    return NextResponse.json(
      success({
        reservations: reservationsDTO,
        total: result.total,
        limit: queryParams.limit,
        offset: queryParams.offset,
      })
    )
  } catch (err: any) {
    console.error('[Reservations API v1] GET list error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch reservations', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
