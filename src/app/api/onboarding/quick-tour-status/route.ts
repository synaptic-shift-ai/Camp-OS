/**
 * GET /api/onboarding/quick-tour-status
 * Returns whether the current user's company has completed/dismissed the dashboard quick tour.
 *
 * PATCH /api/onboarding/quick-tour-status
 * Marks the quick tour as completed (or dismissed) so the alert no longer shows.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ quickTourCompleted: false }, { status: 401 })
    }

    const { data: company } = await supabase
      .from("companies")
      .select("quick_tour_completed")
      .eq("owner_id", user.id)
      .limit(1)
      .single()

    const quickTourCompleted = Boolean(company?.quick_tour_completed)
    return NextResponse.json({ quickTourCompleted })
  } catch (error) {
    console.error("[Onboarding] quick-tour-status GET error:", error)
    return NextResponse.json(
      { quickTourCompleted: false },
      { status: 500 }
    )
  }
}

export async function PATCH() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error: updateError } = await supabase
      .from("companies")
      .update({
        quick_tour_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", user.id)

    if (updateError) {
      console.error("[Onboarding] quick-tour-status PATCH error:", updateError)
      return NextResponse.json(
        { error: "Failed to update quick tour status" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Onboarding] quick-tour-status PATCH error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
