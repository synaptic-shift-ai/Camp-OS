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

    // Get the user's most recent property (use service role to bypass RLS)
    const supabaseServiceRole = createServiceRoleClient()
    const { data: properties, error: propertyError } = await supabaseServiceRole
      .from("properties")
      .select("id, name, city, state, booking_page_slug, stripe_account_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)

    const property = properties?.[0]

    if (propertyError || !property) {
      return NextResponse.json({ error: "No property found" }, { status: 404 })
    }

    // Get all sites for this property
    const { data: sites, error: sitesError } = await supabaseServiceRole
      .from("sites")
      .select("site_type")
      .eq("property_id", property.id)

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
    const bookingPageUrl = property.booking_page_slug
      ? `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"}/book/${property.booking_page_slug}`
      : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"}/book/${property.id.slice(0, 8)}`

    return NextResponse.json({
      propertyName: property.name,
      city: property.city || "",
      state: property.state || "",
      totalSites: sites?.length || 0,
      siteBreakdown: breakdown || "No sites added",
      stripeConnected: !!property.stripe_account_id,
      bookingPageUrl,
    })
  } catch (error) {
    console.error("[Onboarding] Error fetching completion status:", error)
    return NextResponse.json({ error: "Failed to fetch completion status" }, { status: 500 })
  }
}
