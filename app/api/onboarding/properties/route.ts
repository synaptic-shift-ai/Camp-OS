import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

    // Get user's company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Get all properties for this company
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, name, site_count, onboarding_completed, address, city, state, zip_code, phone, email, description")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })

    if (propertiesError) {
      console.error("Error fetching properties:", propertiesError)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    return NextResponse.json({ properties: properties || [] })
  } catch (error) {
    console.error("Properties API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
