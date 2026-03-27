/**
 * Properties API v1 - Get, Update, Delete by ID
 *
 * Phase 2, Week 5-6: Property Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: /api/dashboard/properties/[id]/update-details (deprecated)
 *
 * CRITICAL (Oct 30 Fix):
 * - Always fetches complete Property entities
 * - onboarding_completed field ALWAYS present
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { UpdatePropertyRequestSchema, type UpdatePropertyRequest } from '@/types/api/v1/schemas/properties'
import { GetPropertyQueryHandler } from '@/modules/PropertyManagement/application/queries/GetPropertyQuery'
import { UpdatePropertyCommandHandler } from '@/modules/PropertyManagement/application/commands/UpdatePropertyCommand'
import { SupabasePropertyRepository } from '@/modules/PropertyManagement/infrastructure/SupabasePropertyRepository'
import { toPropertyDTO } from '@/modules/PropertyManagement/application/DTOs/PropertyDTO'
import { PropertySettings } from '@/modules/PropertyManagement/domain/PropertySettings'

/**
 * GET /api/v1/properties/[propertyId]
 *
 * Get a single property by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId: id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001),
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

    // Execute query using application layer
    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new GetPropertyQueryHandler(repository)

    const property = await queryHandler.execute({ id })

    if (!property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if (property.companyId !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property belongs to different company'),
        { status: 403 }
      )
    }

    // Convert to DTO
    const propertyDTO = toPropertyDTO(property)

    return success(propertyDTO)
  } catch (err: any) {
    console.error('[Properties API v1] GET by ID error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch property', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/properties/[propertyId]
 *
 * Update a property.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId: id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001),
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

    // Verify property exists and belongs to company
    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new GetPropertyQueryHandler(repository)
    const existingProperty = await queryHandler.execute({ id })

    if (!existingProperty) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if (existingProperty.companyId !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property belongs to different company'),
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: UpdatePropertyRequest
    try {
      validatedRequest = UpdatePropertyRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Merge partial settings onto existing (undefined in patch = keep current)
    const settings = validatedRequest.settings
      ? PropertySettings.mergePartial(existingProperty.settings, {
          checkInTime: validatedRequest.settings.checkInTime,
          checkOutTime: validatedRequest.settings.checkOutTime,
          timezone: validatedRequest.settings.timezone,
          cancellationPolicy: validatedRequest.settings.cancellationPolicy,
          minStayNights: validatedRequest.settings.minStayNights,
          maxStayNights: validatedRequest.settings.maxStayNights,
          bookingLeadTimeDays: validatedRequest.settings.bookingLeadTimeDays,
          customRules: validatedRequest.settings.customRules,
          openPeriodFrom: validatedRequest.settings.openPeriodFrom,
          openPeriodUntil: validatedRequest.settings.openPeriodUntil,
        })
      : undefined

    // Execute command using application layer
    const commandHandler = new UpdatePropertyCommandHandler(repository)

    const property = await commandHandler.execute({
      id,
      name: validatedRequest.name,
      description: validatedRequest.description,
      propertyType: validatedRequest.propertyType,
      address: validatedRequest.address,
      city: validatedRequest.city,
      state: validatedRequest.state,
      zipCode: validatedRequest.zipCode,
      country: validatedRequest.country,
      phone: validatedRequest.phone,
      email: validatedRequest.email,
      checkInTime: validatedRequest.checkInTime,
      checkOutTime: validatedRequest.checkOutTime,
      subdomain: validatedRequest.subdomain,
      bookingPageSlug: validatedRequest.bookingPageSlug,
      heroImageUrl: validatedRequest.heroImageUrl,
      settings,
      galleryImages: validatedRequest.galleryImages,
      amenities: validatedRequest.amenities,
      site_amenities: validatedRequest.site_amenities,
      checkInInstructions: validatedRequest.checkInInstructions,
      checkOutInstructions: validatedRequest.checkOutInstructions,
      houseRules: validatedRequest.houseRules,
      cancellation_policy: validatedRequest.cancellation_policy,
      cancellation_policy_config: validatedRequest.cancellation_policy_config,
      terms_and_conditions: validatedRequest.terms_and_conditions,
    })
    
    if (validatedRequest.amenities !== undefined) {
      try {
        const newAmenityIds = Array.isArray(validatedRequest.amenities)
          ? validatedRequest.amenities
              .map((a) => (a && typeof a === 'object' && typeof a.id === 'string' ? a.id.trim() : ''))
              .filter(Boolean)
          : []

        const allowedIdSet = new Set(newAmenityIds.map((id) => id.toLowerCase()))
        const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

        const { data: siteRows } = await supabase
          .from('sites')
          .select('id, amenities, site_amenities, deleted_at')
          .eq('property_id', id)
          .is('deleted_at', null)

        if (Array.isArray(siteRows) && siteRows.length > 0) {
          for (const siteRow of siteRows) {
            const currentAmenities = Array.isArray(siteRow.amenities) ? (siteRow.amenities as unknown[]) : null
            const currentSiteAmenities = Array.isArray(siteRow.site_amenities)
              ? (siteRow.site_amenities as unknown[])
              : null

            const filterIds = (values: unknown[] | null) => {
              if (!Array.isArray(values) || values.length === 0) return null
              const filtered = values
                .map((v) => (typeof v === 'string' ? v : null))
                .filter((v): v is string => typeof v === 'string' && v.length > 0)
                .filter((amenityValue) => {
                  if (!isUuid(amenityValue)) return true
                  return allowedIdSet.has(amenityValue.toLowerCase())
                })
              return filtered.length > 0 ? filtered : null
            }

            const nextAmenities = filterIds(currentAmenities)
            const nextSiteAmenities = filterIds(currentSiteAmenities)

            // Only write if something changed.
            const currentAmenitiesJson = currentAmenities ? JSON.stringify(currentAmenities) : 'null'
            const nextAmenitiesJson = nextAmenities ? JSON.stringify(nextAmenities) : 'null'
            const currentSiteAmenitiesJson = currentSiteAmenities ? JSON.stringify(currentSiteAmenities) : 'null'
            const nextSiteAmenitiesJson = nextSiteAmenities ? JSON.stringify(nextSiteAmenities) : 'null'

            if (
              currentAmenitiesJson !== nextAmenitiesJson ||
              currentSiteAmenitiesJson !== nextSiteAmenitiesJson
            ) {
              await supabase
                .from('sites')
                .update({
                  amenities: nextAmenities,
                  site_amenities: nextSiteAmenities,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', siteRow.id)
                .is('deleted_at', null)
            }
          }
        }
      } catch (amenityCleanupErr) {
        console.error('[Properties API v1] amenity cleanup error:', amenityCleanupErr)
      }
    }

    // Convert to DTO
    const propertyDTO = toPropertyDTO(property)

    return success(propertyDTO)
  } catch (err: any) {
    console.error('[Properties API v1] PATCH error:', err)

    // Handle domain validation errors
    if (err.message.includes('not found')) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, err.message),
        { status: 404 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to update property', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/properties/[propertyId]
 *
 * Delete (soft delete) a property.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId: id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001),
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

    // Verify property exists and belongs to company
    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new GetPropertyQueryHandler(repository)
    const property = await queryHandler.execute({ id })

    if (!property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if (property.companyId !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property belongs to different company'),
        { status: 403 }
      )
    }

    // Soft delete (sets status to INACTIVE)
    await repository.delete(id)

    return success({ deleted: true, id })
  } catch (err: any) {
    console.error('[Properties API v1] DELETE error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to delete property', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
