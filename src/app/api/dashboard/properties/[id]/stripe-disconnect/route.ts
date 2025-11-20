/**
 * DEPRECATED: Stripe Disconnect Endpoint
 *
 * Deprecation Date: 2025-11-05
 * Sunset Date: 2026-02-05 (90 days)
 * Migration Path: Use DELETE /api/v1/properties/{id}/stripe-account
 *
 * This endpoint is DEPRECATED in favor of REST-standard DELETE /api/v1/properties/{id}/stripe-account
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params

  // Log deprecation warning
  console.warn(`[DEPRECATED] POST /api/dashboard/properties/${propertyId}/stripe-disconnect called. Migrate to DELETE /api/v1/properties/${propertyId}/stripe-account`)
  console.warn('  Sunset Date: 2026-02-05 (90 days from deprecation)')
  console.warn('  Migration Guide: Use DELETE instead of POST')

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use service role client to bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Verify property ownership
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (property.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Disconnect Stripe by clearing account details
    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({
        stripe_account_id: null,
        stripe_connected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", propertyId)

    if (updateError) {
      console.error("Error disconnecting Stripe:", updateError)
      return NextResponse.json(
        { error: "Failed to disconnect Stripe" },
        { status: 500 }
      )
    }

    // Add deprecation headers (following RFC 8594)
    const response = NextResponse.json({ success: true })
    response.headers.set('Deprecation', 'true')
    response.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
    response.headers.set('Link', `</api/v1/properties/${propertyId}/stripe-account>; rel="alternate"`)
    response.headers.set(
      'Warning',
      '299 - "Deprecated API - Migrate to DELETE /api/v1/properties/{id}/stripe-account by 2026-02-05"'
    )

    return response
  } catch (error) {
    console.error("Error in stripe-disconnect API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
