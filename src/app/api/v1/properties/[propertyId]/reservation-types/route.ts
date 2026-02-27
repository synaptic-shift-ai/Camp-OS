/**
 * Reservation Types Configuration API
 *
 * GET /api/v1/properties/[propertyId]/reservation-types
 * PUT /api/v1/properties/[propertyId]/reservation-types
 *
 * Manages property-level reservation type configuration.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  parseReservationTypesConfigFromDB,
  parseEnabledReservationTypesFromDB,
} from '@/lib/config/resolution'

// Validation schema for updating reservation types config
const UpdateReservationTypesSchema = z.object({
  enabled_reservation_types: z.array(
    z.enum(['nightly', 'weekly', 'monthly', 'seasonal'])
  ).optional(),
  reservation_type_config: z.object({
    nightly: z.object({
      enabled: z.boolean(),
      min_nights: z.number().min(1),
      max_nights: z.number().nullable(),
      rate_cents: z.number().min(0).nullable().optional(),
    }).optional(),
    weekly: z.object({
      enabled: z.boolean(),
      min_nights: z.number().min(1),
      max_nights: z.number().nullable(),
      rate_cents: z.number().min(0).nullable().optional(),
    }).optional(),
    monthly: z.object({
      enabled: z.boolean(),
      min_nights: z.number().min(1),
      max_nights: z.number().nullable(),
      rate_cents: z.number().min(0).nullable().optional(),
    }).optional(),
    seasonal: z.object({
      enabled: z.boolean(),
      min_nights: z.number().min(1),
      max_nights: z.number().nullable(),
      flat_rate: z.literal(true),
      rate_cents: z.number().min(0).nullable().optional(),
    }).optional(),
  }).optional(),
})

/**
 * GET /api/v1/properties/[propertyId]/reservation-types
 *
 * Get reservation types configuration for a property.
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

    // Fetch property with reservation types config
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id, enabled_reservation_types, reservation_type_config')
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

    // Parse configurations
    const enabledTypes = parseEnabledReservationTypesFromDB(property.enabled_reservation_types)
    const config = parseReservationTypesConfigFromDB(property.reservation_type_config)

    return success({
      property_id: propertyId,
      enabled_reservation_types: enabledTypes,
      reservation_type_config: config,
    })
  } catch (err: any) {
    console.error('[Reservation Types API] GET error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch reservation types config', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/v1/properties/[propertyId]/reservation-types
 *
 * Update reservation types configuration for a property.
 */
export async function PUT(
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
    const validationResult = UpdateReservationTypesSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationResult.error.errors,
        }),
        { status: 400 }
      )
    }

    const { enabled_reservation_types, reservation_type_config } = validationResult.data

    // Build update object
    const updateData: Record<string, any> = {}
    if (enabled_reservation_types !== undefined) {
      updateData.enabled_reservation_types = enabled_reservation_types
    }
    if (reservation_type_config !== undefined) {
      updateData.reservation_type_config = reservation_type_config
    }

    // Update property
    const { data: updatedProperty, error: updateError } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', propertyId)
      .select('id, enabled_reservation_types, reservation_type_config')
      .single()

    if (updateError) {
      console.error('[Reservation Types API] Update error:', updateError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to update reservation types config'),
        { status: 500 }
      )
    }

    // Parse and return updated config
    const enabledTypes = parseEnabledReservationTypesFromDB(updatedProperty.enabled_reservation_types)
    const config = parseReservationTypesConfigFromDB(updatedProperty.reservation_type_config)

    return success({
      property_id: propertyId,
      enabled_reservation_types: enabledTypes,
      reservation_type_config: config,
    })
  } catch (err: any) {
    console.error('[Reservation Types API] PUT error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to update reservation types config', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
