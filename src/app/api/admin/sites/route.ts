/**
 * DEPRECATED: /api/admin/sites
 *
 * This endpoint is deprecated. Use /api/v1/properties/[propertyId]/sites instead.
 *
 * Deprecation Date: 2025-11-05
 * Sunset Date: 2026-02-05 (90 days)
 *
 * Migration Guide: See /api/v1/properties/[propertyId]/sites
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

/**
 * @deprecated Use GET /api/v1/properties/[propertyId]/sites
 */
export async function GET() {
  // Log deprecated endpoint usage for monitoring
  console.warn('[DEPRECATED] GET /api/admin/sites called. Migrate to /api/v1/properties/[propertyId]/sites')
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Create service role client (bypasses RLS to avoid potential recursion issues)
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get user's company
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Get all properties for this company to validate access
    const { data: properties, error: propertiesError } = await supabaseAdmin
      .from("properties")
      .select("id")
      .eq("company_id", company.id)

    if (propertiesError) {
      console.error("Error fetching properties:", propertiesError)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    const propertyIds = properties?.map((p) => p.id) || []

    if (propertyIds.length === 0) {
      return NextResponse.json({ sites: [] })
    }

    // Get all sites for this company's properties
    const { data: sites, error: sitesError } = await supabaseAdmin
      .from("sites")
      .select(
        `
        id,
        property_id,
        site_number,
        site_name,
        site_type,
        max_occupancy,
        max_vehicles,
        size_sqft,
        hookups,
        site_amenities,
        base_price,
        weekend_price,
        status,
        description,
        site_images,
        accessibility_features,
        availability_rules,
        created_at,
        updated_at
      `
      )
      .in("property_id", propertyIds)
      .order("site_number", { ascending: true })

    if (sitesError) {
      console.error("Error fetching sites:", sitesError)
      const response = NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
      response.headers.set('Deprecation', 'true')
      response.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
      response.headers.set('Link', '</api/v1/properties/[propertyId]/sites>; rel="alternate"')
      return response
    }

    const response = NextResponse.json({ sites: sites || [] })
    // Add deprecation headers
    response.headers.set('Deprecation', 'true')
    response.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
    response.headers.set('Link', '</api/v1/properties/[propertyId]/sites>; rel="alternate"')
    response.headers.set('Warning', '299 - "Deprecated API - Use /api/v1/properties/[propertyId]/sites"')
    return response
  } catch (error) {
    console.error("Sites API error:", error)
    const response = NextResponse.json({ error: "Internal server error" }, { status: 500 })
    response.headers.set('Deprecation', 'true')
    response.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
    response.headers.set('Link', '</api/v1/properties/[propertyId]/sites>; rel="alternate"')
    return response
  }
}
