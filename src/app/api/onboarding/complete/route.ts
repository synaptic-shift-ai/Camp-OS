/**
 * DEPRECATED: Complete Onboarding Endpoint
 *
 * Deprecation Date: 2025-11-05
 * Sunset Date: 2026-02-05 (90 days)
 * Migration Path: Use POST /api/v1/properties/{id}/complete-onboarding
 *
 * This endpoint is DEPRECATED in favor of /api/v1/properties/{id}/complete-onboarding
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { generateBookingSlug } from "@/lib/booking/slug-utils"
import { z } from "zod"

const completeSchema = z.object({
  propertyId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  // Log deprecation warning
  console.warn('[DEPRECATED] POST /api/onboarding/complete called. Migrate to POST /api/v1/properties/{id}/complete-onboarding')
  console.warn('  Sunset Date: 2026-02-05 (90 days from deprecation)')
  console.warn('  Migration Guide: Use POST /api/v1/properties/{id}/complete-onboarding')

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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = completeSchema.parse(body)

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createServiceRoleClient()

    // Verify property ownership and get current data
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, owner_id, name, booking_page_slug")
      .eq("id", validatedData.propertyId)
      .single()

    if (propertyError || !property) {
      console.error("Property lookup error:", propertyError)
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (property.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Generate booking page slug if it doesn't exist
    let bookingPageSlug = property.booking_page_slug
    if (!bookingPageSlug) {
      bookingPageSlug = generateBookingSlug(property.name, property.id)
    }

    // Mark onboarding as complete and ensure slug is set
    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({
        onboarding_completed: true,
        booking_page_slug: bookingPageSlug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validatedData.propertyId)

    if (updateError) {
      console.error("Error completing onboarding:", updateError)
      return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 })
    }

    // Seed default automations and email templates for the property
    try {
      const { seedDefaultEmailAutomations } = await import('@/lib/automations/seed-defaults')
      // Fetch company_id for the property
      const { data: propCompany } = await supabaseAdmin
        .from('properties')
        .select('company_id')
        .eq('id', validatedData.propertyId)
        .single()
      if (propCompany?.company_id) {
        await seedDefaultEmailAutomations(validatedData.propertyId, propCompany.company_id)
      }
    } catch (seedError) {
      console.error('[Onboarding Complete] Failed to seed default automations:', seedError)
      // Non-blocking — onboarding completion still succeeds
    }

    // Add deprecation headers (following RFC 8594)
    const response = NextResponse.json({ success: true })
    response.headers.set('Deprecation', 'true')
    response.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
    response.headers.set('Link', `</api/v1/properties/${validatedData.propertyId}/complete-onboarding>; rel="alternate"`)
    response.headers.set(
      'Warning',
      '299 - "Deprecated API - Migrate to /api/v1/properties/{id}/complete-onboarding by 2026-02-05"'
    )

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 })
    }

    console.error("Complete onboarding API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
