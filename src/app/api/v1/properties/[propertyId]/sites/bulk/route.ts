/**
 * Sites API v1 - Bulk Create
 *
 * Phase 4, Week 13-14: API Deprecation & Cleanup
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: POST /api/dashboard/properties/{id}/sites (with array) - deprecated
 *
 * Bulk site creation for CSV imports and batch operations.
 *
 * Following CLAUDE.md:
 * - BP-4: Multi-tenant isolation (propertyId required)
 * - D-2: Tenant context enforced
 * - T-4: Prefer integration tests over heavy mocking
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { getPricingSourceType } from '@/lib/site-pricing-source'
import { CreateSiteRequestSchema } from '@/types/api/v1/schemas/sites'
import { CreateSiteCommandHandler as CreateSiteCommand } from '@/modules/SiteManagement/application/commands/CreateSiteCommand'
import { SupabaseSiteRepository } from '@/modules/SiteManagement/infrastructure/SupabaseSiteRepository'
import { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'
import { toSiteDTO } from '@/modules/SiteManagement/application/DTOs/SiteDTO'
import { z } from 'zod'

// Bulk request schema
const BulkCreateSitesRequestSchema = z.array(CreateSiteRequestSchema).min(1).max(500)

type BulkCreateSitesRequest = z.infer<typeof BulkCreateSitesRequestSchema>

/**
 * POST /api/v1/properties/[propertyId]/sites/bulk
 *
 * Create multiple sites in a single request (e.g., CSV import).
 *
 * Request Body: Array of CreateSiteRequest (max 500 sites)
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

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: BulkCreateSitesRequest
    try {
      validatedRequest = BulkCreateSitesRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
          message: 'Must be an array of 1-500 site objects',
        }),
        { status: 400 }
      )
    }

    // BP-4: Verify user has access to this property; also fetch pricing config
    // for property-defaults substitution (matches single-site POST behaviour)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id, reservation_type_config')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify user owns this property's company
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', property.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Access denied to this property'),
        { status: 403 }
      )
    }

    // Check for duplicate site numbers in request
    const siteNumbers = validatedRequest.map((s) => s.siteNumber)
    const duplicates = siteNumbers.filter(
      (num, index) => siteNumbers.indexOf(num) !== index
    )

    if (duplicates.length > 0) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Duplicate site numbers in request', {
          duplicates: Array.from(new Set(duplicates)),
        }),
        { status: 400 }
      )
    }

    // Check for existing site numbers in property
    const { data: existingSites } = await supabase
      .from('sites')
      .select('site_number')
      .eq('property_id', propertyId)
      .in('site_number', siteNumbers)

    if (existingSites && existingSites.length > 0) {
      const existingNumbers = existingSites.map((s: any) => s.site_number)
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Site numbers already exist', {
          existing_site_numbers: existingNumbers,
        }),
        { status: 409 }
      )
    }

    // Resolve the property's nightly rate for property-defaults substitution
    const propertyConfig = property.reservation_type_config as Record<string, any> | null
    const propertyNightlyRate: number = propertyConfig?.nightly?.rate_cents ?? 0

    // Execute commands using application layer
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const commandHandler = new CreateSiteCommand(repository)

    const createdSites = []
    const errors: Array<{ siteNumber: string; error: string }> = []

    // Process each site (could be optimized with batch operations in future)
    for (const siteRequest of validatedRequest) {
      try {
        const siteId = crypto.randomUUID()

        // When not manual pricing (property_default or site_type_default) and basePrice is 0,
        // substitute the property's nightly rate — mirrors the single-site POST route behaviour.
        const isUsingPropertyDefaults = getPricingSourceType(siteRequest.enabledReservationTypesOverride) !== 'manual'
        const effectiveBasePrice =
          isUsingPropertyDefaults && siteRequest.basePrice === 0 && propertyNightlyRate > 0
            ? propertyNightlyRate
            : siteRequest.basePrice

        const site = await commandHandler.execute({
          id: siteId,
          propertyId,
          siteNumber: siteRequest.siteNumber,
          siteName: siteRequest.siteName || null,
          siteType: siteRequest.siteType,
          description: siteRequest.description || null,
          basePrice: effectiveBasePrice,
          weekendPrice: siteRequest.weekendPrice || effectiveBasePrice,
          maxOccupancy: siteRequest.maxOccupancy || null,
          maxVehicles: siteRequest.maxVehicles || null,
          sizeSqft: siteRequest.sizeSqft || null,
          amenities: siteRequest.amenities || null,
          hookups: siteRequest.hookups || null,
          images: siteRequest.images || null,
          locationMap: siteRequest.locationMap || null,
        })

        // Save reservation type overrides and rate overrides (mirrors single-site POST)
        const extras: Record<string, unknown> = {}
        if (siteRequest.enabledReservationTypesOverride !== undefined) {
          extras.enabled_reservation_types_override = siteRequest.enabledReservationTypesOverride
        }
        if (siteRequest.weeklyRateCents != null) {
          extras.weekly_rate_cents = siteRequest.weeklyRateCents
        }
        if (siteRequest.monthlyRateCents != null) {
          extras.monthly_rate_cents = siteRequest.monthlyRateCents
        }
        if (siteRequest.seasonalRateCents != null) {
          extras.seasonal_rate_cents = siteRequest.seasonalRateCents
        }
        if (siteRequest.defaultReservationType != null) {
          extras.default_reservation_type = siteRequest.defaultReservationType
        }
        if (Object.keys(extras).length > 0) {
          await supabase.from('sites').update(extras).eq('id', siteId)
        }

        createdSites.push(toSiteDTO(site))
      } catch (siteError: any) {
        errors.push({
          siteNumber: siteRequest.siteNumber,
          error: siteError.message,
        })
      }
    }

    // If all sites failed, return error
    if (createdSites.length === 0 && errors.length > 0) {
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'All sites failed to create', {
          errors,
        }),
        { status: 500 }
      )
    }

    // Return partial success if some sites failed
    const response = {
      sites: createdSites,
      count: createdSites.length,
      total_requested: validatedRequest.length,
      success_rate: Math.round((createdSites.length / validatedRequest.length) * 100),
      ...(errors.length > 0 && { errors }),
    }

    // Log bulk import for monitoring
    console.log(
      `[v1/sites/bulk] Bulk import completed: ${createdSites.length}/${validatedRequest.length} sites created for property ${propertyId} by user ${user.id}`
    )

    // success() already returns a NextResponse - don't double-wrap with NextResponse.json()
    const successResponse = success(response)
    return new NextResponse(successResponse.body, {
      status: 201,
      headers: successResponse.headers,
    })
  } catch (err: any) {
    console.error('[v1/sites/bulk] Bulk create error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to create sites in bulk', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
