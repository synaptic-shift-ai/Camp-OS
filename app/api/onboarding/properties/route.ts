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

    // Get all properties for this company
    console.log('[Properties API] Fetching properties for company:', company.id)
    const { data: properties, error: propertiesError } = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })

    if (propertiesError) {
      console.error("[Properties API] Error fetching properties:", propertiesError)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    console.log('[Properties API] Found properties:', properties?.length || 0)
    if (properties && properties.length > 0) {
      console.log('[Properties API] Property IDs:', properties.map(p => p.id))
      console.log('[Properties API] Onboarding status:', properties.map(p => ({
        id: p.id,
        name: p.name,
        onboarding_completed: p.onboarding_completed
      })))
    }

    return NextResponse.json({ properties: properties || [] })
  } catch (error) {
    console.error("Properties API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
