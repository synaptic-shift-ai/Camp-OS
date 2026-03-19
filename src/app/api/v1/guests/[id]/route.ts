/**
 * Guests API v1 - Get, Update by ID
 *
 * Phase 2, Week 7: Guest Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 *
 * GET    /api/v1/guests/[id] - Get guest by ID
 * PATCH  /api/v1/guests/[id] - Update guest
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { UpdateGuestRequestSchema, type UpdateGuestRequest } from '@/types/api/v1/schemas/guests'
import { GetGuestQueryHandler } from '@/modules/GuestManagement/application/queries/GetGuestQuery'
import { UpdateGuestCommandHandler } from '@/modules/GuestManagement/application/commands/UpdateGuestCommand'
import { DeleteGuestCommandHandler } from '@/modules/GuestManagement/application/commands/DeleteGuestCommand'
import { SupabaseGuestRepository } from '@/modules/GuestManagement/infrastructure/SupabaseGuestRepository'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus/InMemoryEventBus'
import { GuestDTOMapper } from '@/modules/GuestManagement/application/DTOs/GuestDTO'

/**
 * GET /api/v1/guests/[id]
 *
 * Get a single guest by ID.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001, 'Unauthorized'), { status: 401 })
    }

    // Execute query using application layer
    const repository = new SupabaseGuestRepository(supabase)
    const queryHandler = new GetGuestQueryHandler(repository)

    const guestDTO = await queryHandler.execute({ guestId: id })

    // Verify user has access to this guest's property (BP-4: Multi-tenant isolation)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', guestDTO.propertyId)
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
        error(ErrorCodes.AUTH_003, 'Forbidden - guest belongs to different company'),
        { status: 403 }
      )
    }

    const { data: guestRow } = await supabase
      .from('guests')
      .select('address, city, state, zip_code, country, spouse_first_name, spouse_last_name, spouse_email, spouse_phone, spouse_is_alternate_contact')
      .eq('id', id)
      .eq('property_id', guestDTO.propertyId)
      .maybeSingle()

    const { data: vehicles } = await supabase
      .from('guest_vehicles')
      .select('id, vehicle_type, rv_type, personal_vehicle_type, year, make, model, color, license_plate, license_plate_state, is_primary')
      .eq('guest_id', id)
      .eq('property_id', guestDTO.propertyId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    const fallbackAddress = guestRow
      ? {
          street: guestRow.address ?? '',
          city: guestRow.city ?? '',
          state: guestRow.state ?? '',
          zipCode: guestRow.zip_code ?? '',
          country: guestRow.country ?? '',
        }
      : null

    const hasFallbackAddress = fallbackAddress
      ? [
          fallbackAddress.street,
          fallbackAddress.city,
          fallbackAddress.state,
          fallbackAddress.zipCode,
          fallbackAddress.country,
        ].some((value) => value.trim().length > 0)
      : false

    return success({
      ...guestDTO,
      address: guestDTO.address ?? (hasFallbackAddress ? fallbackAddress : null),
      spousePartner: guestRow
        ? {
            firstName: guestRow.spouse_first_name,
            lastName: guestRow.spouse_last_name,
            email: guestRow.spouse_email,
            phone: guestRow.spouse_phone,
            isAlternateContact: guestRow.spouse_is_alternate_contact ?? false,
          }
        : null,
      vehicles: vehicles ?? [],
    })
  } catch (err: any) {
    console.error('[Guests API v1] GET by ID error:', err)

    if (err.message.includes('not found')) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch guest', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/guests/[id]
 *
 * Update a guest.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001, 'Unauthorized'), { status: 401 })
    }

    // Verify guest exists
    const repository = new SupabaseGuestRepository(supabase)
    const queryHandler = new GetGuestQueryHandler(repository)
    const existingGuestDTO = await queryHandler.execute({ guestId: id })

    // Verify user has access to this guest's property (BP-4: Multi-tenant isolation)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', existingGuestDTO.propertyId)
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
        error(ErrorCodes.AUTH_003, 'Forbidden - guest belongs to different company'),
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedRequest = UpdateGuestRequestSchema.safeParse(body)

    if (!validatedRequest.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validatedRequest.error.format(),
        }),
        { status: 400 }
      )
    }

    const updateData: UpdateGuestRequest = validatedRequest.data

    // Execute command using application layer
    const commandHandler = new UpdateGuestCommandHandler(repository, new InMemoryEventBus())

    const guest = await commandHandler.execute({
      guestId: id,
      ...(updateData.firstName !== undefined && { firstName: updateData.firstName }),
      ...(updateData.lastName !== undefined && { lastName: updateData.lastName }),
      ...(updateData.email !== undefined && { email: updateData.email }),
      ...(updateData.phone !== undefined && { phone: updateData.phone }),
      ...(updateData.address !== undefined && { address: updateData.address }),
      ...(updateData.emergencyContactName !== undefined && updateData.emergencyContactName !== null && { emergencyContactName: updateData.emergencyContactName }),
      ...(updateData.emergencyContactPhone !== undefined && updateData.emergencyContactPhone !== null && { emergencyContactPhone: updateData.emergencyContactPhone }),
      ...(updateData.notes !== undefined && updateData.notes !== null && { notes: updateData.notes }),
    })

    // Convert to DTO
    const guestDTO = GuestDTOMapper.fromDomain(guest)

    return success(guestDTO)
  } catch (err: any) {
    console.error('[Guests API v1] PATCH error:', err)

    if (err.message.includes('not found')) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to update guest', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/guests/[id]
 *
 * Soft-deletes a guest. Sets deleted_at timestamp, preserving all FK references.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001, 'Unauthorized'), { status: 401 })
    }

    // Verify guest exists
    const repository = new SupabaseGuestRepository(supabase)
    const queryHandler = new GetGuestQueryHandler(repository)
    const existingGuestDTO = await queryHandler.execute({ guestId: id })

    // Verify user has access to this guest's property (BP-4: Multi-tenant isolation)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', existingGuestDTO.propertyId)
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
        error(ErrorCodes.AUTH_003, 'Forbidden - guest belongs to different company'),
        { status: 403 }
      )
    }

    // Execute soft-delete command
    const commandHandler = new DeleteGuestCommandHandler(repository)
    await commandHandler.execute({ guestId: id, propertyId: existingGuestDTO.propertyId })

    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    console.error('[Guests API v1] DELETE error:', err)

    if (err.message.includes('not found')) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to delete guest', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
