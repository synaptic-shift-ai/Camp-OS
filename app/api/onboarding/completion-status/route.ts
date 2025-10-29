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

    // Use service role to bypass RLS
    const supabaseServiceRole = createServiceRoleClient()

    // Get ALL properties for this user
    const { data: properties, error: propertyError } = await supabaseServiceRole
      .from("properties")
      .select("id, name, description, address, city, state, zip_code, phone, email, booking_page_slug, stripe_account_id, stripe_connected_at, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })

    if (propertyError || !properties || properties.length === 0) {
      return NextResponse.json({ error: "No properties found" }, { status: 404 })
    }

    // Get ALL sites for ALL properties
    const propertyIds = properties.map(p => p.id)
    const { data: allSites, error: sitesError } = await supabaseServiceRole
      .from("sites")
      .select("id, property_id, site_number, site_name, site_type, base_price, status")
      .in("property_id", propertyIds)
      .order("property_id", { ascending: true })
      .order("site_number", { ascending: true })

    if (sitesError) {
      console.error("[Onboarding] Failed to fetch sites:", sitesError)
      return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
    }

    // Generate booking page URL helper
    const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
    const getBookingUrl = (property: any) => {
      return property.booking_page_slug
        ? `${baseUrl}/book/${property.booking_page_slug}`
        : `${baseUrl}/book/${property.id.slice(0, 8)}`
    }

    // Build comprehensive property data
    const propertiesData = properties.map((property) => {
      // Get sites for this property
      const propertySites = allSites?.filter(site => site.property_id === property.id) || []

      // Count sites by type
      const siteTypeCounts: Record<string, number> = {}
      propertySites.forEach((site) => {
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

      return {
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
        stripeConnected: !!property.stripe_account_id,
        stripeConnectedAt: property.stripe_connected_at,
        bookingPageUrl: getBookingUrl(property),
        sites: propertySites,
        totalSites: propertySites.length,
        siteBreakdown: breakdown || "No sites added",
      }
    })

    // Calculate totals
    const totalSites = allSites?.length || 0
    const totalProperties = properties.length
    const propertiesWithStripe = properties.filter(p => p.stripe_account_id).length

    return NextResponse.json({
      properties: propertiesData,
      summary: {
        totalProperties,
        totalSites,
        propertiesWithStripe,
        allStripeConnected: propertiesWithStripe === totalProperties,
      },
    })
  } catch (error) {
    console.error("[Onboarding] Error fetching completion status:", error)
    return NextResponse.json({ error: "Failed to fetch completion status" }, { status: 500 })
  }
}
