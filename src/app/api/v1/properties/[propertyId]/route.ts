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

import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { canEditPropertySettingsModule } from '@/lib/dashboard/property-settings-module-edit'
import { UpdatePropertyRequestSchema, type UpdatePropertyRequest } from '@/types/api/v1/schemas/properties'
import { GetPropertyQueryHandler } from '@/modules/PropertyManagement/application/queries/GetPropertyQuery'
import { UpdatePropertyCommandHandler } from '@/modules/PropertyManagement/application/commands/UpdatePropertyCommand'
import { SupabasePropertyRepository } from '@/modules/PropertyManagement/infrastructure/SupabasePropertyRepository'
import { toPropertyDTO } from '@/modules/PropertyManagement/application/DTOs/PropertyDTO'
import { PropertySettings } from '@/modules/PropertyManagement/domain/PropertySettings'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const AMENITY_PATCH_KEYS = new Set<keyof UpdatePropertyRequest>(['amenities', 'site_amenities'])

const CANCELLATION_TERMS_PATCH_KEYS = new Set<keyof UpdatePropertyRequest>([
  'cancellation_policy',
  'cancellation_policy_config',
  'terms_and_conditions',
])

function buildPropertyPatchActivityDetails(req: UpdatePropertyRequest): string {
  let hasProperty = false
  let hasAmenities = false
  let hasCancellationTerms = false
  for (const key of Object.keys(req) as (keyof UpdatePropertyRequest)[]) {
    if (req[key] === undefined) continue
    if (AMENITY_PATCH_KEYS.has(key)) {
      hasAmenities = true
    } else if (CANCELLATION_TERMS_PATCH_KEYS.has(key)) {
      hasCancellationTerms = true
    } else {
      hasProperty = true
    }
  }

  const parts: string[] = []
  if (hasProperty) parts.push('property')
  if (hasAmenities) parts.push('amenities')
  if (hasCancellationTerms) parts.push('terms & policies')
  if (parts.length === 0) return 'Updated property settings'
  return `Updated property settings (${parts.join(' and ')})`
}

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
      return error(ErrorCodes.AUTH_001)
    }

    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new GetPropertyQueryHandler(repository)

    const property = await queryHandler.execute({ id })

    if (!property) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND)
    }

    // RBAC: verify user has read access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: id,
      minimumRole: 'staff',
    })
    if (isDenied(access)) return access

    return success(toPropertyDTO(property))
  } catch (err: any) {
    console.error('[Properties API v1] GET by ID error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, undefined, {
      message: err.message,
    })
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
      return error(ErrorCodes.AUTH_001)
    }

    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new GetPropertyQueryHandler(repository)
    const existingProperty = await queryHandler.execute({ id })

    if (!existingProperty) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND)
    }

    const canUpdate = await canEditPropertySettingsModule(supabase, id, user.id)
    if (!canUpdate) {
      return error(ErrorCodes.AUTH_006, request)
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: UpdatePropertyRequest
    try {
      validatedRequest = UpdatePropertyRequestSchema.parse(body)
    } catch (validationError: any) {
      return error(ErrorCodes.VALIDATION_ERROR, undefined, {
        errors: validationError.errors,
      })
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
          housekeepingRequireApproval: validatedRequest.settings.housekeepingRequireApproval,
          defaultRefundHandling: validatedRequest.settings.defaultRefundHandling,
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

    if (property.companyId) {
      const supabaseServiceRole = createServiceRoleClient()
      await recordActivityLog(supabaseServiceRole, {
        companyId: property.companyId,
        propertyId: property.id,
        action: 'update',
        resource: 'settings',
        userId: user.id,
        details: buildPropertyPatchActivityDetails(validatedRequest),
      })
    }

    // Convert to DTO
    const propertyDTO = toPropertyDTO(property)

    return success(propertyDTO)
  } catch (err: any) {
    console.error('[Properties API v1] PATCH error:', err)

    // Handle domain validation errors
    if (err.message.includes('not found')) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, undefined, { message: err.message })
    }

    return error(ErrorCodes.INTERNAL_ERROR, undefined, {
      message: err.message,
    })
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
      return error(ErrorCodes.AUTH_001)
    }

    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new GetPropertyQueryHandler(repository)
    const property = await queryHandler.execute({ id })

    if (!property) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND)
    }

    // RBAC: verify user has owner access (only owner can delete)
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: id,
      minimumRole: 'owner',
    })
    if (isDenied(access)) return access


    // Soft delete (sets status to INACTIVE)
    await repository.delete(id)

    return success({ deleted: true, id })
  } catch (err: any) {
    console.error('[Properties API v1] DELETE error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, undefined, {
      message: err.message,
    })
  }
}
