/**
 * Single Seasonal Period API
 *
 * GET /api/v1/properties/[propertyId]/seasonal-periods/[periodId]
 * PUT /api/v1/properties/[propertyId]/seasonal-periods/[periodId]
 * DELETE /api/v1/properties/[propertyId]/seasonal-periods/[periodId]
 *
 * Manages individual seasonal period operations.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'

// Validation schema for updating a seasonal period
const UpdateSeasonalPeriodSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  start_month: z.number().min(1).max(12).optional(),
  start_day: z.number().min(1).max(31).optional(),
  end_month: z.number().min(1).max(12).optional(),
  end_day: z.number().min(1).max(31).optional(),
  base_rate_cents: z.number().min(0).optional(),
  recurring: z.boolean().optional(),
})

/**
 * GET /api/v1/properties/[propertyId]/seasonal-periods/[periodId]
 *
 * Get a single seasonal period.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; periodId: string }> }
) {
  try {
    const { propertyId, periodId } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001), { status: 401 })
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
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if (property.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property belongs to different company'),
        { status: 403 }
      )
    }

    // Fetch seasonal period
    const { data: period, error: periodError } = await supabase
      .from('property_seasonal_periods')
      .select('*')
      .eq('id', periodId)
      .eq('property_id', propertyId) // Ensure period belongs to property
      .single()

    if (periodError || !period) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Seasonal period not found'),
        { status: 404 }
      )
    }

    return success(period)
  } catch (err: any) {
    console.error('[Seasonal Period API] GET error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch seasonal period', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/v1/properties/[propertyId]/seasonal-periods/[periodId]
 *
 * Update a seasonal period.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; periodId: string }> }
) {
  try {
    const { propertyId, periodId } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001), { status: 401 })
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
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if (property.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property belongs to different company'),
        { status: 403 }
      )
    }

    // Verify seasonal period exists and belongs to property
    const { data: existingPeriod, error: existingError } = await supabase
      .from('property_seasonal_periods')
      .select('id')
      .eq('id', periodId)
      .eq('property_id', propertyId)
      .single()

    if (existingError || !existingPeriod) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Seasonal period not found'),
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = UpdateSeasonalPeriodSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationResult.error.errors,
        }),
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Update seasonal period
    const { data: updatedPeriod, error: updateError } = await supabase
      .from('property_seasonal_periods')
      .update(updateData)
      .eq('id', periodId)
      .select()
      .single()

    if (updateError) {
      // Check for duplicate name constraint violation
      if (updateError.code === '23505') {
        return NextResponse.json(
          error(ErrorCodes.VALIDATION_ERROR, 'A seasonal period with this name already exists'),
          { status: 409 }
        )
      }
      console.error('[Seasonal Period API] Update error:', updateError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to update seasonal period'),
        { status: 500 }
      )
    }

    return success(updatedPeriod)
  } catch (err: any) {
    console.error('[Seasonal Period API] PUT error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to update seasonal period', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/properties/[propertyId]/seasonal-periods/[periodId]
 *
 * Delete a seasonal period.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; periodId: string }> }
) {
  try {
    const { propertyId, periodId } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001), { status: 401 })
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
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if (property.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - property belongs to different company'),
        { status: 403 }
      )
    }

    // Verify seasonal period exists and belongs to property
    const { data: existingPeriod, error: existingError } = await supabase
      .from('property_seasonal_periods')
      .select('id')
      .eq('id', periodId)
      .eq('property_id', propertyId)
      .single()

    if (existingError || !existingPeriod) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Seasonal period not found'),
        { status: 404 }
      )
    }

    // Delete seasonal period (cascade will delete site_seasonal_rates)
    const { error: deleteError } = await supabase
      .from('property_seasonal_periods')
      .delete()
      .eq('id', periodId)

    if (deleteError) {
      console.error('[Seasonal Period API] Delete error:', deleteError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to delete seasonal period'),
        { status: 500 }
      )
    }

    return success({ deleted: true, id: periodId })
  } catch (err: any) {
    console.error('[Seasonal Period API] DELETE error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to delete seasonal period', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
