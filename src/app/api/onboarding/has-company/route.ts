import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/onboarding/has-company
 *
 * Returns whether the authenticated user has a company.
 * Used by onboarding page to redirect to company-details vs property wizard.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ hasCompany: false }, { status: 401 })
    }

    const { data: companies } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)

    const hasCompany = Boolean(companies && companies.length > 0)
    return NextResponse.json({ hasCompany })
  } catch (error) {
    console.error("[Onboarding] has-company error:", error)
    return NextResponse.json({ hasCompany: false }, { status: 500 })
  }
}
