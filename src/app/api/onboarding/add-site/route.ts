import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    // Get the user's most recent property (use service role to bypass RLS)
    const supabaseServiceRole = createServiceRoleClient()
    const { data: properties, error: propertyError } = await supabaseServiceRole
      .from("properties")
      .select("id, onboarding_completed")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)

    const property = properties?.[0]

    if (propertyError || !property) {
      console.error("[Onboarding] Failed to fetch property:", propertyError)
      return NextResponse.json({ error: "No property found. Please complete property setup first." }, { status: 404 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: "Site name is required" }, { status: 400 })
    }

    if (!body.type) {
      return NextResponse.json({ error: "Site type is required" }, { status: 400 })
    }

    if (!body.maxOccupancy || body.maxOccupancy < 1 || body.maxOccupancy > 50) {
      return NextResponse.json({ error: "Max occupancy must be between 1 and 50" }, { status: 400 })
    }

    if (!body.nightlyRate || body.nightlyRate < 0) {
      return NextResponse.json({ error: "Nightly rate is required and must be positive" }, { status: 400 })
    }

    // Validate site type
    const validTypes = ["tent", "rv", "cabin", "glamping", "yurt", "other"]
    if (!validTypes.includes(body.type)) {
      return NextResponse.json({ error: "Invalid site type" }, { status: 400 })
    }

    // Convert nightly rate to cents if it's in dollars
    const nightlyRateInCents = Math.round(parseFloat(body.nightlyRate) * 100)

    // Prepare hookups (default to all false if not provided)
    const hookups = body.hookups || { water: false, electric: false, sewer: false }

    // Create the site
    const { data: site, error } = await supabaseServiceRole
      .from("sites")
      .insert({
        property_id: property.id,
        site_name: body.name,
        site_number: body.name, // Use name as number for now
        site_type: body.type,
        max_occupancy: body.maxOccupancy,
        base_price: nightlyRateInCents,
        hookups: hookups,
        description: body.description || "",
        status: "available",
      })
      .select()
      .single()

    if (error) {
      console.error("[Onboarding] Failed to create site:", error)
      return NextResponse.json({ error: "Failed to add site" }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        message: "Site added successfully",
        siteId: site.id,
        site: {
          id: site.id,
          name: site.site_name,
          type: site.site_type,
          maxOccupancy: site.max_occupancy,
          nightlyRate: site.base_price,
          hookups: site.hookups,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[Onboarding] Error adding site:", error)
    return NextResponse.json({ error: "Failed to add site" }, { status: 500 })
  }
}
