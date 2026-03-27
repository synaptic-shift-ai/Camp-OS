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
import { getPricingSourceType, serializePricingSourceForPricingOverride } from '@/lib/site-pricing-source'

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
      .is('deleted_at', null)
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
      .is('deleted_at', null)
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

    // Handle enabled_reservation_types_override - in the new encoding this is the
    // manual checkbox array. Backward compat: legacy encoding may contain {source: ...}.
    // Accept both camelCase and snake_case from client
    let reservationTypesOverride =
      body.enabledReservationTypesOverride !== undefined
        ? body.enabledReservationTypesOverride
        : body.enabled_reservation_types_override !== undefined
          ? body.enabled_reservation_types_override
          : existingSite.enabled_reservation_types_override

    // Handle pricing_override (new source selector)
    const pricingOverride =
      body.pricingOverride !== undefined
        ? body.pricingOverride
        : body.pricing_override !== undefined
          ? body.pricing_override
          : existingSite.pricing_override

    const existingPricingOverride =
      existingSite.pricing_override != null && typeof existingSite.pricing_override === 'object'
        ? (existingSite.pricing_override as Record<string, unknown>)
        : null

    // Backward compat: if pricingOverride is missing but enabledReservationTypesOverride
    // was using the legacy "{ source: ... }" encoding, derive pricing_override.source.
    let effectivePricingOverride = pricingOverride
    if (body.pricingOverride === undefined && body.pricing_override === undefined) {
      const derivedSource = (() => {
        const parsedSource = getPricingSourceType(reservationTypesOverride)
        return parsedSource
      })()

      // If reservationTypesOverride is an object (legacy non-manual), we can't infer manual types.
      // Store the derived pricing source and normalize enabled_reservation_types_override to [].
      if (!Array.isArray(reservationTypesOverride) && derivedSource !== 'manual') {
        effectivePricingOverride = {
          ...(existingPricingOverride ?? {}),
          ...serializePricingSourceForPricingOverride(derivedSource),
        }
        reservationTypesOverride = []
      }
    }

    // Merge the new `source` field into existing pricing_override JSON (if any),
    // to avoid clobbering unrelated pricing override keys.
    if (
      body.pricingOverride !== undefined ||
      body.pricing_override !== undefined
    ) {
      const overrideObj =
        pricingOverride != null && typeof pricingOverride === 'object'
          ? (pricingOverride as Record<string, unknown>)
          : null
      if (overrideObj) {
        effectivePricingOverride = {
          ...(existingPricingOverride ?? {}),
          ...overrideObj,
        }
      }
    }

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

    const availabilityRules = body.availability_rules?.blocked_dates
    if (availabilityRules?.length > 0) {
      for (const block of availabilityRules) {
        const { data: conflictingReservations } = await supabase
          .from('reservations')
          .select('id')
          .eq('site_id', siteId)
          .in('status', ['confirmed', 'checked_in', 'pending'])
          .lte('check_in_date', block.to)
          .gte('check_out_date', block.from)

        if (conflictingReservations && conflictingReservations.length > 0) {
          return error('VALIDATION_ERROR', 'The selected date for housekeeping is not available, please select a different date', 400)
        }
      }
    }

    const newStatus = body.status ?? existingSite.status
    const isScheduledStatus = newStatus === 'housekeeping' || newStatus === 'maintenance'
    const existingRules = (existingSite.availability_rules as { blocked_dates?: unknown[] } | null) ?? {}
    const resolvedAvailabilityRules =
      body.availability_rules !== undefined
        ? body.availability_rules
        : !isScheduledStatus && Array.isArray(existingRules.blocked_dates) && existingRules.blocked_dates.length > 0
          ? { ...existingRules, blocked_dates: [] }
          : existingSite.availability_rules

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
        amenities: body.amenities ?? body.site_amenities ?? existingSite.amenities,
        allow_pets: body.allow_pets ?? body.allowPets ?? existingSite.allow_pets,
        pet_fee: body.pet_fee ?? body.petFee ?? existingSite.pet_fee,
        ada_accessible: body.ada_accessible ?? body.adaAccessible ?? existingSite.ada_accessible,
        accessibility_features:
          body.accessibility_features ?? body.accessibilityFeatures ?? existingSite.accessibility_features,
        status: newStatus,
        availability_rules: resolvedAvailabilityRules,
        site_images: body.images ?? body.site_images ?? existingSite.site_images,
        enabled_reservation_types_override: reservationTypesOverride,
        pricing_override: effectivePricingOverride,
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
      return error(ErrorCodes.AUTH_001, request)
    }

    // Fetch existing site for tenant validation
    const { data: existingSite, error: siteError } = await supabase
      .from('sites')
      .select('*, properties!inner(id, company_id)')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !existingSite) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request)
    }

    // BP-4: Verify user owns this property's company
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', existingSite.properties.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return error(ErrorCodes.AUTH_002, request)
    }

    // Check for active or future reservations before attempting delete.
    // These reservations block deletion due to integrity/business rules.
    const todayISODate = new Date().toISOString().split('T')[0]
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id')
      .eq('site_id', siteId)
      .in('status', ['confirmed', 'checked_in', 'pending'])
      .gte('check_out_date', todayISODate)

    if (reservationsError) {
      console.error('[v1/sites] Delete reservation check error:', reservationsError)
      return error('SYS_003', 'Failed to validate site delete constraints', 500, request, reservationsError)
    }

    if (reservations && reservations.length > 0) {
      return error(ErrorCodes.SITE_005.code, ErrorCodes.SITE_005.message, ErrorCodes.SITE_005.status, request, {
        siteId,
        today: todayISODate,
      })
    }

    // Soft delete the site (do not hard delete)
    const now = new Date().toISOString()
    const { error: deleteError } = await supabase
      .from('sites')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', siteId)
      .is('deleted_at', null)

    if (deleteError) {
      console.error('[v1/sites] Delete error:', deleteError)
      const status = deleteError.code === '23503' ? 409 : 500
      const message =
        deleteError.code === '23503'
          ? 'Cannot delete site because it is referenced by other records.'
          : deleteError.message || 'Failed to delete site'
      return error('SITE_DELETE_FAILED', message, status, request, deleteError)
    }

    return success({ deleted: true, id: siteId })
  } catch (err: any) {
    console.error('[v1/sites] DELETE error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request)
  }
}
