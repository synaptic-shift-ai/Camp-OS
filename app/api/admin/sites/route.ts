import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export async function GET() {
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
        weekend_price_cents,
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
      return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
    }

    return NextResponse.json({ sites: sites || [] })
  } catch (error) {
    console.error("Sites API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
