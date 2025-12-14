/**
 * Individual Site API v1 - GET, PUT, DELETE
 *
 * Following CLAUDE.md:
 * - BP-4: Multi-tenant isolation
 * - D-2: Tenant context enforced
 */

import { NextRequest, NextResponse } from 'next/server'
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
    const { properties, ...siteData } = site

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

    // Update the site
    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({
        site_number: body.site_number ?? body.siteNumber ?? existingSite.site_number,
        site_name: body.site_name ?? body.siteName ?? existingSite.site_name,
        site_type: body.site_type ?? body.siteType ?? existingSite.site_type,
        description: body.description ?? existingSite.description,
        base_price: body.base_price ?? body.basePrice ?? existingSite.base_price,
        weekend_price_cents: body.weekend_price_cents ?? body.weekendPrice ?? existingSite.weekend_price_cents,
        max_occupancy: body.max_occupancy ?? body.maxOccupancy ?? existingSite.max_occupancy,
        max_vehicles: body.max_vehicles ?? body.maxVehicles ?? existingSite.max_vehicles,
        size_sqft: body.size_sqft ?? body.sizeSqft ?? existingSite.size_sqft,
        hookups: body.hookups ?? existingSite.hookups,
        site_amenities: body.site_amenities ?? body.amenities ?? existingSite.site_amenities,
        status: body.status ?? existingSite.status,
        site_images: body.site_images ?? body.images ?? existingSite.site_images,
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
