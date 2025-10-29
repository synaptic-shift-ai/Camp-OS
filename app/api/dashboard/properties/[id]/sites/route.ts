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
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId } = await params
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

    // Prepare sites for insertion
    const sitesToInsert = sites.map((site) => ({
      property_id: propertyId,
      site_number: site.site_number,
      site_name: site.site_name || null,
      site_type: site.site_type,
      max_occupancy: site.max_occupancy || 4,
      max_vehicles: site.max_vehicles || 1,
      size_sqft: site.size_sqft || null,
      status: site.status || "available",
      description: site.description || null,
      base_price: site.base_price, // Already in cents from frontend
      weekend_price_cents: site.weekend_price_cents || null,
      hookups: site.hookups || [],
      site_amenities: site.site_amenities || [],
      site_images: site.site_images || [],
      availability_rules: site.availability_rules || {},
      accessibility_features: site.accessibility_features || [],
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

    return NextResponse.json({
      success: true,
      sites: createdSites,
      count: createdSites?.length || 0,
    })
  } catch (error) {
    console.error("Error in POST /api/dashboard/properties/[id]/sites:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
