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
      .select("id, onboarding_step, onboarding_completed")
      .eq("owner_id", user.id)
      .limit(1)

    const company = companies?.[0]
    const hasCompany = Boolean(company)

    if (!hasCompany || !company) {
      return NextResponse.json({
        hasCompany: false,
        propertyId: null,
        onboardingStep: null,
        onboardingCompleted: false,
      })
    }

    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("company_id", company.id)
      .limit(1)

    const propertyId = properties?.[0]?.id ?? null
    return NextResponse.json({
      hasCompany: true,
      propertyId,
      onboardingStep: company.onboarding_step ?? null,
      onboardingCompleted: company.onboarding_completed ?? false,
    })
  } catch (error) {
    console.error("[Onboarding] has-company error:", error)
    return NextResponse.json({ hasCompany: false }, { status: 500 })
  }
}
