/**
 * Properties API v1 - List & Create
 *
 * Phase 2, Week 5-6: Property Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: /api/onboarding/properties (deprecated)
 *
 * Following CLAUDE.md:
 * - BP-4: Multi-tenant isolation (companyId required)
 * - D-2: Tenant context enforced
 * - C-6: Use import type for type-only imports
 *
 * Following IMPLEMENTATION_PLAN.md:
 * - Standard response envelopes
 * - Zod validation on request/response
 * - Complete entity fetching (no selective .select())
 * - Contract tests verify all fields
 *
 * CRITICAL (Oct 30 Fix):
 * - Always fetches complete Property entities
 * - onboarding_completed field ALWAYS present
 * - Prevents middleware redirect loops
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  CreatePropertyRequestSchema,
  ListPropertiesQuerySchema,
  type CreatePropertyRequest,
  type ListPropertiesQuery,
} from '@/types/api/v1/schemas/properties'
import { ListPropertiesQueryHandler } from '@/modules/PropertyManagement/application/queries/ListPropertiesQuery'
import { CreatePropertyCommandHandler } from '@/modules/PropertyManagement/application/commands/CreatePropertyCommand'
import { SupabasePropertyRepository } from '@/modules/PropertyManagement/infrastructure/SupabasePropertyRepository'
import { toPropertyDTO, toPropertyDTOs } from '@/modules/PropertyManagement/application/DTOs/PropertyDTO'
import { PropertySettings } from '@/modules/PropertyManagement/domain/PropertySettings'
import { v4 as uuidv4 } from 'uuid'

/**
 * GET /api/v1/properties
 *
 * List all properties for the authenticated user's company.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - per_page: number (default: 20, max: 100)
 * - status: 'draft' | 'active' | 'inactive' | 'closed'
 * - onboarding_complete: boolean
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse and validate query parameters
    const url = new URL(request.url)
    const queryParams = {
      page: parseInt(url.searchParams.get('page') || '1'),
      per_page: parseInt(url.searchParams.get('per_page') || '20'),
      status: url.searchParams.get('status') || undefined,
      onboarding_complete: url.searchParams.get('onboarding_complete') || undefined,
    }

    let validatedQuery: ListPropertiesQuery
    try {
      validatedQuery = ListPropertiesQuerySchema.parse(queryParams)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid query parameters', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Calculate offset
    const limit = validatedQuery.per_page
    const offset = (validatedQuery.page - 1) * limit

    // Execute query using application layer
    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new ListPropertiesQueryHandler(repository)

    const result = await queryHandler.execute({
      companyId: company.id,
      ...(validatedQuery.status !== undefined && { status: validatedQuery.status }),
      ...(validatedQuery.onboarding_complete !== undefined && { onboardingComplete: validatedQuery.onboarding_complete }),
      limit,
      offset,
    })

    // Convert domain entities to DTOs
    const propertyDTOs = toPropertyDTOs(result.properties)

    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / limit)
    const hasNextPage = validatedQuery.page < totalPages
    const hasPreviousPage = validatedQuery.page > 1

    return success({
      items: propertyDTOs,
      pagination: {
        page: validatedQuery.page,
        per_page: limit,
        total: result.total,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_previous_page: hasPreviousPage,
      },
    })
  } catch (err: any) {
    console.error('[Properties API v1] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, undefined, {
      message: err.message,
    })
  }
}

/**
 * POST /api/v1/properties
 *
 * Create a new property.
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: CreatePropertyRequest
    try {
      validatedRequest = CreatePropertyRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Parse settings if provided
    const settings = validatedRequest.settings
      ? PropertySettings.create(validatedRequest.settings)
      : PropertySettings.default()

    // Execute command using application layer
    const repository = new SupabasePropertyRepository(supabase)
    const commandHandler = new CreatePropertyCommandHandler(repository)

    const property = await commandHandler.execute({
      id: uuidv4(),
      companyId: company.id,
      ownerId: user.id,
      name: validatedRequest.name,
      slug: validatedRequest.slug,
      ...(validatedRequest.description !== undefined && { description: validatedRequest.description }),
      ...(validatedRequest.propertyType !== undefined && { propertyType: validatedRequest.propertyType }),
      ...(validatedRequest.address !== undefined && { address: validatedRequest.address }),
      ...(validatedRequest.city !== undefined && { city: validatedRequest.city }),
      ...(validatedRequest.state !== undefined && { state: validatedRequest.state }),
      ...(validatedRequest.zipCode !== undefined && { zipCode: validatedRequest.zipCode }),
      ...(validatedRequest.country !== undefined && { country: validatedRequest.country }),
      ...(validatedRequest.phone !== undefined && { phone: validatedRequest.phone }),
      ...(validatedRequest.email !== undefined && { email: validatedRequest.email }),
      ...(validatedRequest.subdomain !== undefined && { subdomain: validatedRequest.subdomain }),
      ...(validatedRequest.bookingPageSlug !== undefined && { bookingPageSlug: validatedRequest.bookingPageSlug }),
      ...(settings !== undefined && { settings }),
      ...(validatedRequest.amenities !== undefined && { amenities: validatedRequest.amenities }),
    })

    // Convert to DTO
    const propertyDTO = toPropertyDTO(property)

    // success() already returns a NextResponse - don't double-wrap with NextResponse.json()
    const response = success(propertyDTO)
    return new NextResponse(response.body, {
      status: 201,
      headers: response.headers,
    })
  } catch (err: any) {
    console.error('[Properties API v1] POST error:', err)

    // Handle domain validation errors
    if (err.message.includes('already exists')) {
      return NextResponse.json(
        error(ErrorCodes.DUPLICATE_RESOURCE, err.message),
        { status: 409 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to create property', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
