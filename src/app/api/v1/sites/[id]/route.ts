/**
 * Site API v1 - Get, Update, Delete
 *
 * Phase 1, Week 4: API Migration & Testing
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: /api/admin/sites/[id] (deprecated)
 *
 * Following CLAUDE.md:
 * - BP-4: Multi-tenant isolation
 * - D-2: Tenant context enforced
 * - C-6: Use import type for type-only imports
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  UpdateSiteRequestSchema,
  type UpdateSiteRequest,
} from '@/types/api/v1/schemas/sites'
import { GetSiteQueryHandler as GetSiteQuery } from '@/modules/SiteManagement/application/queries/GetSiteQuery'
import { UpdateSiteCommandHandler as UpdateSiteCommand } from '@/modules/SiteManagement/application/commands/UpdateSiteCommand'
import { SupabaseSiteRepository } from '@/modules/SiteManagement/infrastructure/SupabaseSiteRepository'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus/InMemoryEventBus'
import { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'
import { toSiteDTO } from '@/modules/SiteManagement/application/DTOs/SiteDTO'

/**
 * GET /api/v1/sites/[id]
 *
 * Get a single site by ID.
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
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Execute query using application layer
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const queryHandler = new GetSiteQuery(repository)

    const site = await queryHandler.execute({ siteId: id })

    if (!site) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_001, 'Site not found'),
        { status: 404 }
      )
    }

    // BP-4: Verify user has access to this site's property
    const { data: property } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', site.propertyId)
      .single()

    if (!property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_004, 'Property not found'),
        { status: 404 }
      )
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', property.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_002, 'Access denied to this site'),
        { status: 403 }
      )
    }

    // Convert domain entity to DTO
    const siteDTO = toSiteDTO(site)

    return NextResponse.json(success(siteDTO))
  } catch (err: any) {
    console.error('[v1/sites] Get site error:', err)
    return NextResponse.json(
      error(ErrorCodes.SERVER_001, 'Internal server error'),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/sites/[id]
 *
 * Update a site (partial update).
 *
 * Request Body: UpdateSiteRequest
 */
export async function PATCH(
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
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: UpdateSiteRequest
    try {
      validatedRequest = UpdateSiteRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_001, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // First, get the site to verify access
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const getSiteQuery = new GetSiteQuery(repository)
    const existingSite = await getSiteQuery.execute({ siteId: id })

    if (!existingSite) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_001, 'Site not found'),
        { status: 404 }
      )
    }

    // BP-4: Verify user has access to this site's property
    const { data: property } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', existingSite.propertyId)
      .single()

    if (!property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_004, 'Property not found'),
        { status: 404 }
      )
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', property.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_002, 'Access denied to this site'),
        { status: 403 }
      )
    }

    // Execute command using application layer
    const commandHandler = new UpdateSiteCommand(repository)

    const updatedSite = await commandHandler.execute({
      siteId: id,
      updates: {
        siteName: validatedRequest.siteName,
        siteType: validatedRequest.siteType,
        description: validatedRequest.description,
        basePrice: validatedRequest.basePrice,
        weekendPrice: validatedRequest.weekendPrice,
        maxOccupancy: validatedRequest.maxOccupancy,
        maxVehicles: validatedRequest.maxVehicles,
        sizeSqft: validatedRequest.sizeSqft,
        amenities: validatedRequest.amenities,
        hookups: validatedRequest.hookups,
        images: validatedRequest.images,
        locationMap: validatedRequest.locationMap,
      },
    })

    // Convert domain entity to DTO
    const siteDTO = toSiteDTO(updatedSite)

    return NextResponse.json(success(siteDTO))
  } catch (err: any) {
    console.error('[v1/sites] Update site error:', err)

    // Handle specific business rule violations
    if (err.message.includes('cannot be updated')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_002, err.message),
        { status: 400 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.SERVER_001, 'Internal server error'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/sites/[id]
 *
 * Delete a site (soft delete - marks as unavailable).
 */
export async function DELETE(
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
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // First, get the site to verify access
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const getSiteQuery = new GetSiteQuery(repository)
    const existingSite = await getSiteQuery.execute({ siteId: id })

    if (!existingSite) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_001, 'Site not found'),
        { status: 404 }
      )
    }

    // BP-4: Verify user has access to this site's property
    const { data: property } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', existingSite.propertyId)
      .single()

    if (!property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_004, 'Property not found'),
        { status: 404 }
      )
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', property.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_002, 'Access denied to this site'),
        { status: 403 }
      )
    }

    // Delete (soft delete via repository)
    await repository.delete(id)

    return NextResponse.json(
      success({
        id,
        deleted: true,
      })
    )
  } catch (err: any) {
    console.error('[v1/sites] Delete site error:', err)

    // Handle specific business rule violations
    if (err.message.includes('has active reservations')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_003, err.message),
        { status: 400 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.SERVER_001, 'Internal server error'),
      { status: 500 }
    )
  }
}
