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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/src/lib/api/response'
import { ERROR_CODES } from '@/src/lib/api/errors'
import { CreateSiteRequestSchema, type CreateSiteRequest } from '@/types/api/v1/schemas/sites'
import { CreateSiteCommand } from '@/src/modules/SiteManagement/application/commands/CreateSiteCommand'
import { SupabaseSiteRepository } from '@/src/modules/SiteManagement/infrastructure/SupabaseSiteRepository'
import { InMemoryEventBus } from '@/src/shared/infrastructure/eventBus/InMemoryEventBus'
import { SupabaseContext } from '@/src/shared/infrastructure/database/SupabaseContext'
import { toSiteDTO } from '@/src/modules/SiteManagement/application/DTOs/SiteDTO'
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
        error(ERROR_CODES.AUTH_001, 'Unauthorized'),
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
        error(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
          message: 'Must be an array of 1-500 site objects',
        }),
        { status: 400 }
      )
    }

    // BP-4: Verify user has access to this property
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ERROR_CODES.RESOURCE_NOT_FOUND, 'Property not found'),
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
        error(ERROR_CODES.AUTH_003, 'Access denied to this property'),
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
        error(ERROR_CODES.VALIDATION_ERROR, 'Duplicate site numbers in request', {
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
        error(ERROR_CODES.VALIDATION_ERROR, 'Site numbers already exist', {
          existing_site_numbers: existingNumbers,
        }),
        { status: 409 }
      )
    }

    // Execute commands using application layer
    const eventBus = new InMemoryEventBus()
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const commandHandler = new CreateSiteCommand(repository, eventBus)

    const createdSites = []
    const errors: Array<{ siteNumber: string; error: string }> = []

    // Process each site (could be optimized with batch operations in future)
    for (const siteRequest of validatedRequest) {
      try {
        const site = await commandHandler.execute({
          propertyId,
          siteNumber: siteRequest.siteNumber,
          siteName: siteRequest.siteName || null,
          siteType: siteRequest.siteType,
          description: siteRequest.description || null,
          basePrice: siteRequest.basePrice,
          weekendPrice: siteRequest.weekendPrice || siteRequest.basePrice,
          maxOccupancy: siteRequest.maxOccupancy || null,
          maxVehicles: siteRequest.maxVehicles || null,
          sizeSqft: siteRequest.sizeSqft || null,
          amenities: siteRequest.amenities || null,
          hookups: siteRequest.hookups || null,
          images: siteRequest.images || null,
          locationMap: siteRequest.locationMap || null,
        })

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
        error(ERROR_CODES.INTERNAL_ERROR, 'All sites failed to create', {
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

    return NextResponse.json(success(response), { status: 201 })
  } catch (err: any) {
    console.error('[v1/sites/bulk] Bulk create error:', err)

    return NextResponse.json(
      error(ERROR_CODES.INTERNAL_ERROR, 'Failed to create sites in bulk', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
