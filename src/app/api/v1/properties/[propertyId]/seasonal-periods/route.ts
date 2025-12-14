/**
 * Seasonal Periods API
 *
 * GET /api/v1/properties/[propertyId]/seasonal-periods
 * POST /api/v1/properties/[propertyId]/seasonal-periods
 *
 * Manages property-level seasonal period definitions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import type { SeasonalPeriod } from '@/lib/config/types'

// Validation schema for creating a seasonal period
const CreateSeasonalPeriodSchema = z.object({
  name: z.string().min(1).max(255),
  start_month: z.number().min(1).max(12),
  start_day: z.number().min(1).max(31),
  end_month: z.number().min(1).max(12),
  end_day: z.number().min(1).max(31),
  base_rate_cents: z.number().min(0),
  recurring: z.boolean().default(true),
})

/**
 * GET /api/v1/properties/[propertyId]/seasonal-periods
 *
 * List all seasonal periods for a property.
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

    // Fetch seasonal periods
    const { data: periods, error: periodsError } = await supabase
      .from('property_seasonal_periods')
      .select('*')
      .eq('property_id', propertyId)
      .order('start_month', { ascending: true })
      .order('start_day', { ascending: true })

    if (periodsError) {
      console.error('[Seasonal Periods API] Fetch error:', periodsError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch seasonal periods'),
        { status: 500 }
      )
    }

    return success({
      property_id: propertyId,
      seasonal_periods: periods || [],
    })
  } catch (err: any) {
    console.error('[Seasonal Periods API] GET error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch seasonal periods', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/properties/[propertyId]/seasonal-periods
 *
 * Create a new seasonal period for a property.
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = CreateSeasonalPeriodSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationResult.error.errors,
        }),
        { status: 400 }
      )
    }

    const periodData = validationResult.data

    // Create seasonal period
    const { data: newPeriod, error: createError } = await supabase
      .from('property_seasonal_periods')
      .insert({
        property_id: propertyId,
        name: periodData.name,
        start_month: periodData.start_month,
        start_day: periodData.start_day,
        end_month: periodData.end_month,
        end_day: periodData.end_day,
        base_rate_cents: periodData.base_rate_cents,
        recurring: periodData.recurring,
      })
      .select()
      .single()

    if (createError) {
      // Check for duplicate name constraint violation
      if (createError.code === '23505') {
        return NextResponse.json(
          error(ErrorCodes.VALIDATION_ERROR, 'A seasonal period with this name already exists'),
          { status: 409 }
        )
      }
      console.error('[Seasonal Periods API] Create error:', createError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to create seasonal period'),
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: newPeriod,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          requestId: crypto.randomUUID(),
        },
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('[Seasonal Periods API] POST error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to create seasonal period', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
