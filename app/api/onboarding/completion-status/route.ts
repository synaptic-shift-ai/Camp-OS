import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET(request: NextRequest) {
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

    // Get property_id from query params
    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get("property_id")

    // Get the specified property or the user's most recent property (use service role to bypass RLS)
    const supabaseServiceRole = createServiceRoleClient()
    let property

    if (propertyId) {
      const { data, error: propertyError } = await supabaseServiceRole
        .from("properties")
        .select("id, name, description, address, city, state, zip_code, phone, email, booking_page_slug, stripe_account_id, stripe_connected_at")
        .eq("id", propertyId)
        .eq("owner_id", user.id)
        .single()

      if (propertyError || !data) {
        return NextResponse.json({ error: "Property not found" }, { status: 404 })
      }
      property = data
    } else {
      const { data: properties, error: propertyError } = await supabaseServiceRole
        .from("properties")
        .select("id, name, description, address, city, state, zip_code, phone, email, booking_page_slug, stripe_account_id, stripe_connected_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)

      property = properties?.[0]

      if (propertyError || !property) {
        return NextResponse.json({ error: "No property found" }, { status: 404 })
      }
    }

    // Get all sites for this property with full details
    const { data: sites, error: sitesError } = await supabaseServiceRole
      .from("sites")
      .select("id, site_number, site_name, site_type, base_price, status")
      .eq("property_id", property.id)
      .order("site_number", { ascending: true })

    if (sitesError) {
      console.error("[Onboarding] Failed to fetch sites:", sitesError)
      return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
    }

    // Count sites by type
    const siteTypeCounts: Record<string, number> = {}
    sites?.forEach((site) => {
      const type = site.site_type
      siteTypeCounts[type] = (siteTypeCounts[type] || 0) + 1
    })

    // Format breakdown string
    const breakdown = Object.entries(siteTypeCounts)
      .map(([type, count]) => {
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
        return `${count} ${typeLabel}`
      })
      .join(", ")

    // Generate booking page URL
    const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
    const bookingPageUrl = property.booking_page_slug
      ? `${baseUrl}/book/${property.booking_page_slug}`
      : `${baseUrl}/book/${property.id.slice(0, 8)}`

    return NextResponse.json({
      property: {
        id: property.id,
        name: property.name,
        description: property.description,
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zip_code,
        phone: property.phone,
        email: property.email,
        bookingPageSlug: property.booking_page_slug,
      },
      sites: sites || [],
      totalSites: sites?.length || 0,
      siteBreakdown: breakdown || "No sites added",
      stripeConnected: !!property.stripe_account_id,
      stripeConnectedAt: property.stripe_connected_at,
      bookingPageUrl,
    })
  } catch (error) {
    console.error("[Onboarding] Error fetching completion status:", error)
    return NextResponse.json({ error: "Failed to fetch completion status" }, { status: 500 })
  }
}
