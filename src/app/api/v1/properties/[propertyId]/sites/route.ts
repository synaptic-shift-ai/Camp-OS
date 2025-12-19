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
import { ErrorCodes, createErrorResponse } from '@/lib/api/errors'
import {
  CreateSiteRequestSchema,
  ListSitesQuerySchema,
  type CreateSiteRequest,
  type ListSitesQuery,
} from '@/types/api/v1/schemas/sites'
import { ListSitesQueryHandler } from '@/modules/SiteManagement/application/queries/ListSitesQuery'
import { CreateSiteCommandHandler as CreateSiteCommand } from '@/modules/SiteManagement/application/commands/CreateSiteCommand'
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
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
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
        error(ErrorCodes.VALIDATION_001, 'Invalid query parameters', {
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
        error(ErrorCodes.RESOURCE_004, 'Property not found'),
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
        error(ErrorCodes.AUTH_002, 'Access denied to this property'),
        { status: 403 }
      )
    }

    // Execute query using application layer
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const queryHandler = new ListSitesQueryHandler(repository)

    // Calculate limit and offset from page and per_page
    const page = validatedQuery.page || 1
    const perPage = validatedQuery.per_page || 20
    const offset = (page - 1) * perPage

    const result = await queryHandler.execute({
      propertyId,
      ...(validatedQuery.status !== undefined && { status: validatedQuery.status }),
      ...(validatedQuery.siteType !== undefined && { siteType: validatedQuery.siteType }),
      ...(perPage !== undefined && { limit: perPage }),
      ...(offset !== undefined && { offset: offset }),
    })

    // Convert domain entities to DTOs
    const siteDTOs = toSiteDTOs(result.sites)

    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / perPage)

    return success({
      items: siteDTOs,
      pagination: {
        page: page,
        per_page: perPage,
        total: result.total,
        total_pages: totalPages,
      },
    })
  } catch (err: any) {
    console.error('[v1/sites] List sites error:', err)
    return NextResponse.json(
      error(ErrorCodes.SERVER_001, 'Internal server error'),
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
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: CreateSiteRequest
    try {
      validatedRequest = CreateSiteRequestSchema.parse(body)
    } catch (validationError: any) {
      console.error('[v1/sites] Validation error:', JSON.stringify(validationError.errors, null, 2))
      console.error('[v1/sites] Request body was:', JSON.stringify(body, null, 2))
      return NextResponse.json(
        createErrorResponse(ErrorCodes.VALIDATION_001, request, {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // BP-4: Verify user has access to this property and fetch pricing defaults
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id, reservation_type_config')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_004, 'Property not found'),
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
        error(ErrorCodes.AUTH_002, 'Access denied to this property'),
        { status: 403 }
      )
    }

    // Determine effective base price:
    // If using property defaults (enabledReservationTypesOverride is null) and basePrice is 0,
    // use the property's nightly rate from reservation_type_config
    let effectiveBasePrice = validatedRequest.basePrice
    const isUsingPropertyDefaults = validatedRequest.enabledReservationTypesOverride === null

    if (isUsingPropertyDefaults && effectiveBasePrice === 0) {
      const config = property.reservation_type_config as Record<string, any> | null
      const propertyNightlyRate = config?.nightly?.rate_cents
      if (propertyNightlyRate && propertyNightlyRate > 0) {
        effectiveBasePrice = propertyNightlyRate
      }
    }

    // Execute command using application layer
    const repository = new SupabaseSiteRepository(new SupabaseContext(supabase))
    const commandHandler = new CreateSiteCommand(repository)

    const siteId = crypto.randomUUID()
    const site = await commandHandler.execute({
      id: siteId,
      propertyId,
      siteNumber: validatedRequest.siteNumber,
      siteName: validatedRequest.siteName || null,
      siteType: validatedRequest.siteType,
      description: validatedRequest.description || null,
      basePrice: effectiveBasePrice,
      weekendPrice: validatedRequest.weekendPrice || effectiveBasePrice,
      maxOccupancy: validatedRequest.maxOccupancy || null,
      maxVehicles: validatedRequest.maxVehicles || null,
      sizeSqft: validatedRequest.sizeSqft || null,
      amenities: validatedRequest.amenities || null,
      hookups: validatedRequest.hookups || null,
      images: validatedRequest.images || null,
      locationMap: validatedRequest.locationMap || null,
    })

    // Save reservation type override and rate overrides if provided
    const siteExtras: Record<string, any> = {}
    if (validatedRequest.enabledReservationTypesOverride !== undefined) {
      siteExtras.enabled_reservation_types_override = validatedRequest.enabledReservationTypesOverride
    }
    if ((validatedRequest as any).seasonalRateCents !== undefined) {
      siteExtras.seasonal_rate_cents = (validatedRequest as any).seasonalRateCents
    }
    if ((validatedRequest as any).weeklyRateCents !== undefined) {
      siteExtras.weekly_rate_cents = (validatedRequest as any).weeklyRateCents
    }
    if ((validatedRequest as any).monthlyRateCents !== undefined) {
      siteExtras.monthly_rate_cents = (validatedRequest as any).monthlyRateCents
    }

    if (Object.keys(siteExtras).length > 0) {
      await supabase
        .from('sites')
        .update(siteExtras)
        .eq('id', siteId)
    }

    // Convert domain entity to DTO
    const siteDTO = toSiteDTO(site)

    // success() already returns a NextResponse - don't double-wrap with NextResponse.json()
    const response = success(siteDTO)
    return new NextResponse(response.body, {
      status: 201,
      headers: response.headers,
    })
  } catch (err: any) {
    console.error('[v1/sites] Create site error:', err)

    // Handle specific business rule violations
    if (err.message?.includes('already exists')) {
      return error(ErrorCodes.VALIDATION_002, undefined, { message: err.message })
    }

    return error(ErrorCodes.SERVER_001, undefined, { message: err.message || 'Unknown error' })
  }
}
