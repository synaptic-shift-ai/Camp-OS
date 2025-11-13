/**
 * Sites API v1 - List & Create
 *
 * Phase 1, Week 4: API Migration & Testing
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: /api/admin/sites (deprecated)
 *
 * Following CLAUDE.md:
 * - BP-4: Multi-tenant isolation (propertyId required)
 * - D-2: Tenant context enforced
 * - C-6: Use import type for type-only imports
 * - C-1: TDD for CRITICAL code (HIGH risk: customer-facing)
 *
 * Following IMPLEMENTATION_PLAN.md:
 * - Standard response envelopes
 * - Zod validation on request/response
 * - Complete entity fetching (no selective .select())
 * - Contract tests verify all fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ERROR_CODES } from '@/lib/api/errors'
import {
  CreateSiteRequestSchema,
  ListSitesQuerySchema,
  type CreateSiteRequest,
  type ListSitesQuery,
} from '@/types/api/v1/schemas/sites'
import { ListSitesQuery as ListSitesQueryHandler } from '@/modules/SiteManagement/application/queries/ListSitesQuery'
import { CreateSiteCommand } from '@/modules/SiteManagement/application/commands/CreateSiteCommand'
import { SupabaseSiteRepository } from '@/modules/SiteManagement/infrastructure/SupabaseSiteRepository'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus/InMemoryEventBus'
import { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'
import { toSiteDTO, toSiteDTOs } from '@/modules/SiteManagement/application/DTOs/SiteDTO'

/**
 * GET /api/v1/properties/[propertyId]/sites
 *
 * List all sites for a property with optional filtering and pagination.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - per_page: number (default: 20, max: 100)
 * - status: 'available' | 'occupied' | 'maintenance' | 'unavailable'
 * - siteType: 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'
 * - minPrice: number (cents)
 * - maxPrice: number (cents)
 * - minOccupancy: number
 * - sort_by: string
 * - sort_order: 'asc' | 'desc'
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
        error(ERROR_CODES.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Parse and validate query parameters
    const url = new URL(request.url)
    const queryParams = {
      page: parseInt(url.searchParams.get('page') || '1'),
      per_page: parseInt(url.searchParams.get('per_page') || '20'),
      status: url.searchParams.get('status') || undefined,
      siteType: url.searchParams.get('siteType') || undefined,
      minPrice: url.searchParams.get('minPrice')
        ? parseInt(url.searchParams.get('minPrice')!)
        : undefined,
      maxPrice: url.searchParams.get('maxPrice')
        ? parseInt(url.searchParams.get('maxPrice')!)
        : undefined,
      minOccupancy: url.searchParams.get('minOccupancy')
        ? parseInt(url.searchParams.get('minOccupancy')!)
        : undefined,
      sort_by: url.searchParams.get('sort_by') || undefined,
      sort_order: (url.searchParams.get('sort_order') as 'asc' | 'desc') || 'asc',
    }

    let validatedQuery: ListSitesQuery
    try {
      validatedQuery = ListSitesQuerySchema.parse(queryParams)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ERROR_CODES.VALIDATION_001, 'Invalid query parameters', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // BP-4: Verify user has access to this property (multi-tenant isolation)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ERROR_CODES.RESOURCE_004, 'Property not found'),
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
        error(ERROR_CODES.AUTH_002, 'Access denied to this property'),
        { status: 403 }
      )
    }

    // Execute query using application layer
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const queryHandler = new ListSitesQueryHandler(repository)

    const result = await queryHandler.execute({
      propertyId,
      filters: {
        status: validatedQuery.status,
        siteType: validatedQuery.siteType,
        minPrice: validatedQuery.minPrice,
        maxPrice: validatedQuery.maxPrice,
        minOccupancy: validatedQuery.minOccupancy,
      },
      pagination: {
        page: validatedQuery.page,
        perPage: validatedQuery.per_page,
      },
      sorting: {
        sortBy: validatedQuery.sort_by,
        sortOrder: validatedQuery.sort_order,
      },
    })

    // Convert domain entities to DTOs
    const siteDTOs = toSiteDTOs(result.sites)

    return NextResponse.json(
      success({
        items: siteDTOs,
        pagination: {
          page: result.pagination.page,
          per_page: result.pagination.perPage,
          total: result.pagination.total,
          total_pages: result.pagination.totalPages,
        },
      })
    )
  } catch (err: any) {
    console.error('[v1/sites] List sites error:', err)
    return NextResponse.json(
      error(ERROR_CODES.SERVER_001, 'Internal server error'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/properties/[propertyId]/sites
 *
 * Create a new site for a property.
 *
 * Request Body: CreateSiteRequest
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

    let validatedRequest: CreateSiteRequest
    try {
      validatedRequest = CreateSiteRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ERROR_CODES.VALIDATION_001, 'Invalid request body', {
          errors: validationError.errors,
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
        error(ERROR_CODES.RESOURCE_004, 'Property not found'),
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
        error(ERROR_CODES.AUTH_002, 'Access denied to this property'),
        { status: 403 }
      )
    }

    // Execute command using application layer
    const eventBus = new InMemoryEventBus()
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const commandHandler = new CreateSiteCommand(repository, eventBus)

    const site = await commandHandler.execute({
      propertyId,
      siteNumber: validatedRequest.siteNumber,
      siteName: validatedRequest.siteName || null,
      siteType: validatedRequest.siteType,
      description: validatedRequest.description || null,
      basePrice: validatedRequest.basePrice,
      weekendPrice: validatedRequest.weekendPrice || validatedRequest.basePrice,
      maxOccupancy: validatedRequest.maxOccupancy || null,
      maxVehicles: validatedRequest.maxVehicles || null,
      sizeSqft: validatedRequest.sizeSqft || null,
      amenities: validatedRequest.amenities || null,
      hookups: validatedRequest.hookups || null,
      images: validatedRequest.images || null,
      locationMap: validatedRequest.locationMap || null,
    })

    // Convert domain entity to DTO
    const siteDTO = toSiteDTO(site)

    return NextResponse.json(success(siteDTO), { status: 201 })
  } catch (err: any) {
    console.error('[v1/sites] Create site error:', err)

    // Handle specific business rule violations
    if (err.message.includes('already exists')) {
      return NextResponse.json(
        error(ERROR_CODES.VALIDATION_002, err.message),
        { status: 409 }
      )
    }

    return NextResponse.json(
      error(ERROR_CODES.SERVER_001, 'Internal server error'),
      { status: 500 }
    )
  }
}
