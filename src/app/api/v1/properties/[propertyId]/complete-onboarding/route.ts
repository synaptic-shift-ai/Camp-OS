/**
 * Properties API v1 - Complete Onboarding
 *
 * Phase 4, Week 13-14: API Deprecation & Cleanup
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: /api/onboarding/complete (deprecated)
 *
 * Marks a property's onboarding process as complete.
 * This is typically called when the user finishes the setup wizard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { GetPropertyQueryHandler } from '@/modules/PropertyManagement/application/queries/GetPropertyQuery'
import { UpdatePropertyCommandHandler } from '@/modules/PropertyManagement/application/commands/UpdatePropertyCommand'
import { SupabasePropertyRepository } from '@/modules/PropertyManagement/infrastructure/SupabasePropertyRepository'
import { toPropertyDTO } from '@/modules/PropertyManagement/application/DTOs/PropertyDTO'

/**
 * POST /api/v1/properties/[propertyId]/complete-onboarding
 *
 * Complete the onboarding process for a property.
 */
export async function POST(
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

    // Complete onboarding using domain method
    property.completeOnboarding()

    // Save to database
    await repository.save(property)

    // Convert to DTO
    const propertyDTO = toPropertyDTO(property)

    return NextResponse.json(success(propertyDTO))
  } catch (err: any) {
    console.error('[Properties API v1] Complete onboarding error:', err)

    // Handle domain validation errors
    if (err.message.includes('not found')) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, err.message),
        { status: 404 }
      )
    }

    if (err.message.includes('already complete')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Onboarding already completed'),
        { status: 400 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to complete onboarding', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
