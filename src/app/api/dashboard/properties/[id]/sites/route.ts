/**
 * DEPRECATED: Create Sites Endpoint
 *
 * Deprecation Date: 2025-11-05
 * Sunset Date: 2026-02-05 (90 days)
 * Migration Path: Use POST /api/v1/properties/{id}/sites or POST /api/v1/properties/{id}/sites/bulk
 *
 * This endpoint is DEPRECATED in favor of:
 * - POST /api/v1/properties/{id}/sites (single site)
 * - POST /api/v1/properties/{id}/sites/bulk (multiple sites)
 */

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"

/**
 * POST /api/dashboard/properties/[id]/sites
 * Create one or more sites for a property
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params

  // Log deprecation warning
  console.warn(`[DEPRECATED] POST /api/dashboard/properties/${propertyId}/sites called. Migrate to POST /api/v1/properties/${propertyId}/sites`)
  console.warn('  Sunset Date: 2026-02-05 (90 days from deprecation)')
  console.warn('  Migration Guide: Use POST /api/v1/properties/{id}/sites or /api/v1/properties/{id}/sites/bulk')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Create service role client to bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Verify property ownership
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, company_id")
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, owner_id")
      .eq("id", property.company_id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    if (company.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Validate request body - expect either single site or array of sites
    const sites = Array.isArray(body) ? body : [body]

    if (sites.length === 0) {
      return NextResponse.json(
        { error: "At least one site is required" },
        { status: 400 }
      )
    }

    // Validate each site
    const validTypes = ["tent", "rv", "cabin", "glamping", "yurt", "other"]
    const validStatuses = ["available", "unavailable", "maintenance"]

    for (const site of sites) {
      if (!site.site_number) {
        return NextResponse.json(
          { error: "Site number is required for all sites" },
          { status: 400 }
        )
      }

      if (!site.site_type || !validTypes.includes(site.site_type)) {
        return NextResponse.json(
          { error: `Invalid site type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        )
      }

      if (!site.base_price || site.base_price < 1) {
        return NextResponse.json(
          { error: "Base price is required and must be at least 1 cent" },
          { status: 400 }
        )
      }

      if (site.max_occupancy && (site.max_occupancy < 1 || site.max_occupancy > 50)) {
        return NextResponse.json(
          { error: "Max occupancy must be between 1 and 50" },
          { status: 400 }
        )
      }

      if (site.status && !validStatuses.includes(site.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Check for duplicate site numbers in request
    const siteNumbers = sites.map((s) => s.site_number)
    const duplicates = siteNumbers.filter(
      (num, index) => siteNumbers.indexOf(num) !== index
    )

    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: `Duplicate site numbers in request: ${duplicates.join(", ")}` },
        { status: 400 }
      )
    }

    // Check for existing site numbers in property
    const { data: existingSites } = await supabaseAdmin
      .from("sites")
      .select("site_number")
      .eq("property_id", propertyId)
      .in("site_number", siteNumbers)

    if (existingSites && existingSites.length > 0) {
      const existingNumbers = existingSites.map((s) => s.site_number)
      return NextResponse.json(
        { error: `Site numbers already exist: ${existingNumbers.join(", ")}` },
        { status: 400 }
      )
    }

    // Detect if this is a bulk CSV import (array with multiple sites)
    const isBulkImport = Array.isArray(body) && sites.length > 1

    // Prepare sites for insertion
    const sitesToInsert = sites.map((site) => ({
      property_id: propertyId,
      site_number: site.site_number,
      site_name: site.site_name || null,
      site_type: site.site_type,
      max_occupancy: site.max_occupancy || 4,
      max_vehicles: site.max_vehicles ?? 1,
      size_sqft: site.size_sqft || null,
      status: site.status || "available",
      description: site.description || null,
      base_price: site.base_price, // Already in cents from frontend
      weekend_price: site.weekend_price || null,
      hookups: site.hookups || [],
      amenities: site.site_amenities || site.amenities || [],
      images: site.site_images || site.images || [],
      location_map: site.location_map || null,
      allow_pets: site.allow_pets || false,
      pet_fee: site.pet_fee || null,
      ada_accessible: site.ada_accessible || false,
      accessibility_features: site.accessibility_features || [],
      seasonal_pricing: site.seasonal_pricing || [],
      availability_rules: site.availability_rules || {},
      // Add import metadata if this is a bulk import
      ...(isBulkImport && {
        imported_at: new Date().toISOString(),
        imported_by: user.id,
      }),
    }))

    // Insert sites using service role client
    const { data: createdSites, error: insertError } = await supabaseAdmin
      .from("sites")
      .insert(sitesToInsert)
      .select()

    if (insertError) {
      console.error("Error creating sites:", insertError)
      return NextResponse.json(
        { error: "Failed to create sites" },
        { status: 500 }
      )
    }

    // Log bulk imports for monitoring and debugging
    if (isBulkImport) {
      console.log(`Bulk CSV import completed: ${createdSites?.length || 0} sites created for property ${propertyId} by user ${user.id}`)
    }

    // Add deprecation headers (following RFC 8594)
    const response = NextResponse.json({
      success: true,
      sites: createdSites,
      count: createdSites?.length || 0,
    })
    response.headers.set('Deprecation', 'true')
    response.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
    response.headers.set('Link', `</api/v1/properties/${propertyId}/sites>; rel="alternate"`)
    response.headers.set(
      'Warning',
      '299 - "Deprecated API - Migrate to POST /api/v1/properties/{id}/sites by 2026-02-05"'
    )

    return response
  } catch (error) {
    console.error("Error in POST /api/dashboard/properties/[id]/sites:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
