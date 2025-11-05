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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ERROR_CODES } from '@/lib/api/errors'
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
        error(ERROR_CODES.AUTH_001, 'Unauthorized'),
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
        error(ERROR_CODES.RESOURCE_NOT_FOUND, 'Company not found'),
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
        error(ERROR_CODES.VALIDATION_ERROR, 'Invalid query parameters', {
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
      status: validatedQuery.status,
      onboardingComplete: validatedQuery.onboarding_complete,
      limit,
      offset,
    })

    // Convert domain entities to DTOs
    const propertyDTOs = toPropertyDTOs(result.properties)

    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / limit)
    const hasNextPage = validatedQuery.page < totalPages
    const hasPreviousPage = validatedQuery.page > 1

    return NextResponse.json(
      success({
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
    )
  } catch (err: any) {
    console.error('[Properties API v1] GET error:', err)
    return NextResponse.json(
      error(ERROR_CODES.INTERNAL_ERROR, 'Failed to fetch properties', {
        message: err.message,
      }),
      { status: 500 }
    )
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
        error(ERROR_CODES.AUTH_001, 'Unauthorized'),
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
        error(ERROR_CODES.RESOURCE_NOT_FOUND, 'Company not found'),
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
        error(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', {
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
      description: validatedRequest.description,
      propertyType: validatedRequest.propertyType,
      address: validatedRequest.address,
      city: validatedRequest.city,
      state: validatedRequest.state,
      zipCode: validatedRequest.zipCode,
      country: validatedRequest.country,
      phone: validatedRequest.phone,
      email: validatedRequest.email,
      subdomain: validatedRequest.subdomain,
      bookingPageSlug: validatedRequest.bookingPageSlug,
      settings,
      amenities: validatedRequest.amenities,
    })

    // Convert to DTO
    const propertyDTO = toPropertyDTO(property)

    return NextResponse.json(success(propertyDTO), { status: 201 })
  } catch (err: any) {
    console.error('[Properties API v1] POST error:', err)

    // Handle domain validation errors
    if (err.message.includes('already exists')) {
      return NextResponse.json(
        error(ERROR_CODES.DUPLICATE_RESOURCE, err.message),
        { status: 409 }
      )
    }

    return NextResponse.json(
      error(ERROR_CODES.INTERNAL_ERROR, 'Failed to create property', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
