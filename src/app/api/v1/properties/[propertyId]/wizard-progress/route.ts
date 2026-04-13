/**
 * Properties API v1 - Wizard Progress
 *
 * Phase 4, Week 13-14: API Deprecation & Cleanup
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: POST /api/dashboard/properties/{id}/wizard-progress (deprecated)
 *
 * Updates the wizard progress tracking for a property.
 * Note: wizard_progress is infrastructure-level tracking (JSONB), not core domain logic.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { z } from 'zod'

// Request validation schema
const WizardProgressRequestSchema = z.object({
  step: z.string().min(1),
  completed: z.boolean(),
})

type WizardProgressRequest = z.infer<typeof WizardProgressRequestSchema>

/**
 * PATCH /api/v1/properties/[propertyId]/wizard-progress
 *
 * Update wizard progress tracking for a property.
 */
export async function PATCH(
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

    // RBAC: verify user has access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'manager',
    })
    if (isDenied(access)) return access

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest: WizardProgressRequest
    try {
      validatedRequest = WizardProgressRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Verify property exists and belongs to company
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id, wizard_progress')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Update wizard progress
    const currentProgress = (property.wizard_progress as Record<string, boolean>) || {}
    const updatedProgress = {
      ...currentProgress,
      [validatedRequest.step]: validatedRequest.completed,
    }

    // Map 'review_launch' to 'complete' for database constraint
    // Database only allows: not_started, property_details, sites_setup, dashboard_tour, stripe_connect, complete
    const dbStep = validatedRequest.step === 'review_launch' ? 'complete' : validatedRequest.step

    // Update database
    const { data: updatedProperty, error: updateError } = await supabase
      .from('properties')
      .update({
        wizard_progress: updatedProgress,
        wizard_step_completed: dbStep,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId)
      .select()
      .single()

    if (updateError) {
      console.error('[Properties API v1] Wizard progress update error:', updateError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to update wizard progress'),
        { status: 500 }
      )
    }

    return success({
      id: updatedProperty.id,
      wizard_progress: updatedProgress,
      wizard_step_completed: dbStep,
    })
  } catch (err: any) {
    console.error('[Properties API v1] Wizard progress error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to update wizard progress', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
