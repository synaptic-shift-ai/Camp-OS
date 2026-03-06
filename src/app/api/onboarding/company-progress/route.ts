/**
 * PATCH /api/onboarding/company-progress
 *
 * Update company onboarding step and/or completed flag so users can resume where they left off.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const WIZARD_STEP_VALUES = [
  "company_details",
  "property_details",
  "sites_setup",
  "dashboard_tour",
  "stripe_connect",
  "review_launch",
  "completed",
] as const

const BodySchema = z.object({
  onboardingStep: z.enum(WIZARD_STEP_VALUES).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id, owner_id")
      .eq("owner_id", user.id)
      .limit(1)
      .single()

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.onboardingStep !== undefined) {
      update.onboarding_step = parsed.data.onboardingStep
    }
    if (parsed.data.onboardingCompleted !== undefined) {
      update.onboarding_completed = parsed.data.onboardingCompleted
    }

    const { error: updateError } = await supabase
      .from("companies")
      .update(update)
      .eq("id", company.id)

    if (updateError) {
      console.error("[Onboarding] company-progress update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update progress" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Onboarding] company-progress error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
