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

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { GetPropertyQueryHandler } from '@/modules/PropertyManagement/application/queries/GetPropertyQuery'
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

    // RBAC: verify user has owner access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'owner',
    })
    if (isDenied(access)) return access

    // Verify property exists
    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new GetPropertyQueryHandler(repository)
    const property = await queryHandler.execute({ id: propertyId })

    if (!property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Complete onboarding using domain method
    property.completeOnboarding()

    // Save to database
    await repository.save(property)

    // Seed default automations and email templates for the property
    try {
      const { seedDefaultEmailAutomations } = await import('@/lib/automations/seed-defaults')
      await seedDefaultEmailAutomations(property.id, property.companyId)
    } catch (seedError) {
      console.error('[Properties] Failed to seed default automations on onboarding:', seedError)
      // Non-blocking — onboarding completion still succeeds
    }

    // Convert to DTO
    const propertyDTO = toPropertyDTO(property)

    return success(propertyDTO)
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
