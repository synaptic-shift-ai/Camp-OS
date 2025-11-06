/**
 * DEPRECATED: Wizard Progress Endpoint
 *
 * Deprecation Date: 2025-11-05
 * Sunset Date: 2026-02-05 (90 days)
 * Migration Path: Use PATCH /api/v1/properties/{id}/wizard-progress
 *
 * This endpoint is DEPRECATED in favor of REST-standard PATCH /api/v1/properties/{id}/wizard-progress
 */

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params

  // Log deprecation warning
  console.warn(`[DEPRECATED] POST /api/dashboard/properties/${propertyId}/wizard-progress called. Migrate to PATCH /api/v1/properties/${propertyId}/wizard-progress`)
  console.warn('  Sunset Date: 2026-02-05 (90 days from deprecation)')
  console.warn('  Migration Guide: Use PATCH instead of POST')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { step, completed } = await request.json()

    if (!step || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: step, completed" },
        { status: 400 }
      )
    }

    // Create service role client to bypass RLS recursion
    const supabaseAdmin = createServiceRoleClient()

    // Verify property ownership using service role client
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, owner_id, wizard_progress")
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (property.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update wizard progress
    const currentProgress = property.wizard_progress || {}
    const updatedProgress = {
      ...currentProgress,
      [step]: completed,
    }

    // Map 'review_launch' to 'complete' for database constraint
    // Database only allows: not_started, property_details, sites_setup, dashboard_tour, stripe_connect, complete
    const dbStep = step === 'review_launch' ? 'complete' : step

    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({
        wizard_progress: updatedProgress,
        wizard_step_completed: dbStep,
        updated_at: new Date().toISOString(),
      })
      .eq("id", propertyId)

    if (updateError) {
      console.error("Error updating wizard progress:", updateError)
      return NextResponse.json(
        { error: "Failed to update wizard progress" },
        { status: 500 }
      )
    }

    // Add deprecation headers (following RFC 8594)
    const response = NextResponse.json({
      success: true,
      progress: updatedProgress,
    })
    response.headers.set('Deprecation', 'true')
    response.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
    response.headers.set('Link', `</api/v1/properties/${propertyId}/wizard-progress>; rel="alternate"`)
    response.headers.set(
      'Warning',
      '299 - "Deprecated API - Migrate to PATCH /api/v1/properties/{id}/wizard-progress by 2026-02-05"'
    )

    return response
  } catch (error) {
    console.error("Error in wizard-progress API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
