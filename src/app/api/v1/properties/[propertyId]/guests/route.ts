/**
 * Guests API v1 - List and Create
 *
 * Phase 2, Week 7: Guest Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: /lib/booking/guest.ts createOrGetGuest (functional approach)
 *
 * GET    /api/v1/properties/[propertyId]/guests - List all guests for property
 * POST   /api/v1/properties/[propertyId]/guests - Create new guest
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  CreateGuestRequestSchema,
  ListGuestsQuerySchema,
  type CreateGuestRequest,
} from '@/types/api/v1/schemas/guests'
import { ListGuestsQueryHandler } from '@/modules/GuestManagement/application/queries/ListGuestsQuery'
import { CreateGuestCommandHandler } from '@/modules/GuestManagement/application/commands/CreateGuestCommand'
import { SupabaseGuestRepository } from '@/modules/GuestManagement/infrastructure/SupabaseGuestRepository'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus/InMemoryEventBus'
import { GuestDTOMapper } from '@/modules/GuestManagement/application/DTOs/GuestDTO'

/**
 * GET /api/v1/properties/[propertyId]/guests
 *
 * List all guests for a property.
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

    // Verify user has access to this property (BP-4: Multi-tenant isolation)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify user owns the company (tenant isolation)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', property.company_id)
      .eq('owner_id', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property belongs to different company'),
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      email: searchParams.get('email') || undefined,
      hasStripeCustomer: searchParams.get('hasStripeCustomer') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const validatedQuery = ListGuestsQuerySchema.safeParse(queryParams)

    if (!validatedQuery.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid query parameters', {
          errors: validatedQuery.error.format(),
        }),
        { status: 400 }
      )
    }

    // Execute query using application layer
    const repository = new SupabaseGuestRepository(supabase)
    const queryHandler = new ListGuestsQueryHandler(repository)

    const guests = await queryHandler.execute({
      propertyId: propertyId,
    })

    // Query handler already returns DTOs
    const guestDTOs = guests

    // Apply client-side filtering if needed
    let filteredGuests = guestDTOs

    if (validatedQuery.data.email) {
      filteredGuests = filteredGuests.filter((g) =>
        g.email.toLowerCase().includes(validatedQuery.data.email!.toLowerCase())
      )
    }

    if (validatedQuery.data.hasStripeCustomer !== undefined) {
      filteredGuests = filteredGuests.filter(
        (g) => g.hasStripeCustomer === validatedQuery.data.hasStripeCustomer
      )
    }

    // Apply pagination
    const total = filteredGuests.length
    const limit = validatedQuery.data.limit || 20
    const offset = validatedQuery.data.offset || 0
    const paginatedGuests = filteredGuests.slice(offset, offset + limit)

    return success({
      items: paginatedGuests,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        per_page: limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    })
  } catch (err: any) {
    console.error('[Guests API v1] GET error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch guests', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/properties/[propertyId]/guests
 *
 * Create a new guest or return existing if email already exists.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const supabase = await createClient()

    // Authenticate user (optional for guest booking - could be public)
    // For now, require auth for create
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

    // Verify user has access to this property (BP-4: Multi-tenant isolation)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify user owns the company (tenant isolation)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', property.company_id)
      .eq('owner_id', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property belongs to different company'),
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedRequest = CreateGuestRequestSchema.safeParse(body)

    if (!validatedRequest.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validatedRequest.error.format(),
        }),
        { status: 400 }
      )
    }

    const createData: CreateGuestRequest = validatedRequest.data

    // Execute command using application layer
    const repository = new SupabaseGuestRepository(supabase)
    const commandHandler = new CreateGuestCommandHandler(repository, new InMemoryEventBus())

    const guest = await commandHandler.execute({
      propertyId: propertyId,
      firstName: createData.firstName,
      lastName: createData.lastName,
      email: createData.email,
      phone: createData.phone,
      ...(createData.address !== undefined && { address: createData.address }),
      ...(createData.emergencyContactName !== undefined && { emergencyContactName: createData.emergencyContactName }),
      ...(createData.emergencyContactPhone !== undefined && { emergencyContactPhone: createData.emergencyContactPhone }),
      ...(createData.userId !== undefined && { userId: createData.userId }),
      ...(createData.notes !== undefined && { notes: createData.notes }),
    })

    // Convert to DTO
    const guestDTO = GuestDTOMapper.fromDomain(guest)

    // success() already returns a NextResponse - don't double-wrap with NextResponse.json()
    const response = success(guestDTO)
    return new NextResponse(response.body, {
      status: 201,
      headers: response.headers,
    })
  } catch (err: any) {
    console.error('[Guests API v1] POST error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to create guest', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
