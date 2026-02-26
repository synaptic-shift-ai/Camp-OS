/**
 * Individual Site API v1 - GET, PUT, DELETE
 *
 * Following CLAUDE.md:
 * - BP-4: Multi-tenant isolation
 * - D-2: Tenant context enforced
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'

/**
 * GET /api/v1/sites/[siteId]
 * Fetch a single site by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001, 'Unauthorized'), { status: 401 })
    }

    // Fetch site with property info for tenant validation
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*, properties!inner(id, company_id)')
      .eq('id', siteId)
      .single()

    if (siteError || !site) {
      return NextResponse.json(error(ErrorCodes.RESOURCE_NOT_FOUND, 'Site not found'), { status: 404 })
    }

    // BP-4: Verify user owns this property's company
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', site.properties.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(error(ErrorCodes.AUTH_002, 'Access denied'), { status: 403 })
    }

    // Remove nested properties from response
    const { properties: _properties, ...siteData } = site

    return success(siteData)
  } catch (err: any) {
    console.error('[v1/sites] GET error:', err)
    return NextResponse.json(error(ErrorCodes.INTERNAL_ERROR, 'Internal server error'), { status: 500 })
  }
}

/**
 * PUT /api/v1/sites/[siteId]
 * Update a site
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001, 'Unauthorized'), { status: 401 })
    }

    // Fetch existing site for tenant validation
    const { data: existingSite, error: siteError } = await supabase
      .from('sites')
      .select('*, properties!inner(id, company_id)')
      .eq('id', siteId)
      .single()

    if (siteError || !existingSite) {
      return NextResponse.json(error(ErrorCodes.RESOURCE_NOT_FOUND, 'Site not found'), { status: 404 })
    }

    // BP-4: Verify user owns this property's company
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', existingSite.properties.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(error(ErrorCodes.AUTH_002, 'Access denied'), { status: 403 })
    }

    const body = await request.json()

    // Handle enabled_reservation_types_override - null means use property defaults
    // Accept both camelCase and snake_case from client
    const reservationTypesOverride =
      body.enabledReservationTypesOverride !== undefined
        ? body.enabledReservationTypesOverride
        : body.enabled_reservation_types_override !== undefined
          ? body.enabled_reservation_types_override
          : existingSite.enabled_reservation_types_override

    // Handle seasonal_rate_cents - accept camelCase or snake_case
    const seasonalRateCents =
      body.seasonalRateCents !== undefined
        ? body.seasonalRateCents
        : body.seasonal_rate_cents !== undefined
          ? body.seasonal_rate_cents
          : existingSite.seasonal_rate_cents

    // Handle weekly_rate_cents
    const weeklyRateCents =
      body.weeklyRateCents !== undefined
        ? body.weeklyRateCents
        : body.weekly_rate_cents !== undefined
          ? body.weekly_rate_cents
          : existingSite.weekly_rate_cents

    // Handle monthly_rate_cents
    const monthlyRateCents =
      body.monthlyRateCents !== undefined
        ? body.monthlyRateCents
        : body.monthly_rate_cents !== undefined
          ? body.monthly_rate_cents
          : existingSite.monthly_rate_cents

    // Handle default_reservation_type
    const defaultReservationType =
      body.defaultReservationType !== undefined
        ? body.defaultReservationType
        : body.default_reservation_type !== undefined
          ? body.default_reservation_type
          : existingSite.default_reservation_type

    // Update the site
    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({
        site_number: body.site_number ?? body.siteNumber ?? existingSite.site_number,
        site_name: body.site_name ?? body.siteName ?? existingSite.site_name,
        site_type: body.site_type ?? body.siteType ?? existingSite.site_type,
        description: body.description ?? existingSite.description,
        base_price: body.base_price ?? body.basePrice ?? existingSite.base_price,
        weekend_price: body.weekend_price ?? body.weekendPrice ?? existingSite.weekend_price,
        weekly_rate_cents: weeklyRateCents,
        monthly_rate_cents: monthlyRateCents,
        max_occupancy: body.max_occupancy ?? body.maxOccupancy ?? existingSite.max_occupancy,
        max_vehicles: body.max_vehicles ?? body.maxVehicles ?? existingSite.max_vehicles,
        size_sqft: body.size_sqft ?? body.sizeSqft ?? existingSite.size_sqft,
        hookups: body.hookups ?? existingSite.hookups,
        site_amenities: body.site_amenities ?? body.amenities ?? existingSite.site_amenities,
        status: body.status ?? existingSite.status,
        site_images: body.site_images ?? body.images ?? existingSite.site_images,
        enabled_reservation_types_override: reservationTypesOverride,
        seasonal_rate_cents: seasonalRateCents,
        default_reservation_type: defaultReservationType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .select()
      .single()

    if (updateError) {
      console.error('[v1/sites] Update error:', updateError)
      return NextResponse.json(error(ErrorCodes.INTERNAL_ERROR, 'Failed to update site'), { status: 500 })
    }

    return success(updatedSite)
  } catch (err: any) {
    console.error('[v1/sites] PUT error:', err)
    return NextResponse.json(error(ErrorCodes.INTERNAL_ERROR, 'Internal server error'), { status: 500 })
  }
}

/**
 * DELETE /api/v1/sites/[siteId]
 * Delete a site
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001, 'Unauthorized'), { status: 401 })
    }

    // Fetch existing site for tenant validation
    const { data: existingSite, error: siteError } = await supabase
      .from('sites')
      .select('*, properties!inner(id, company_id)')
      .eq('id', siteId)
      .single()

    if (siteError || !existingSite) {
      return NextResponse.json(error(ErrorCodes.RESOURCE_NOT_FOUND, 'Site not found'), { status: 404 })
    }

    // BP-4: Verify user owns this property's company
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', existingSite.properties.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(error(ErrorCodes.AUTH_002, 'Access denied'), { status: 403 })
    }

    // Delete the site
    const { error: deleteError } = await supabase
      .from('sites')
      .delete()
      .eq('id', siteId)

    if (deleteError) {
      console.error('[v1/sites] Delete error:', deleteError)
      return NextResponse.json(error(ErrorCodes.INTERNAL_ERROR, 'Failed to delete site'), { status: 500 })
    }

    return success({ deleted: true, id: siteId })
  } catch (err: any) {
    console.error('[v1/sites] DELETE error:', err)
    return NextResponse.json(error(ErrorCodes.INTERNAL_ERROR, 'Internal server error'), { status: 500 })
  }
}
