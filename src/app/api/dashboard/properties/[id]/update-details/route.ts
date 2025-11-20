/**
 * DEPRECATED: Update Property Details Endpoint
 *
 * Deprecation Date: 2025-11-05
 * Sunset Date: 2026-02-05 (90 days)
 * Migration Path: Use PATCH /api/v1/properties/{id}
 *
 * This endpoint is DEPRECATED in favor of REST-standard PATCH /api/v1/properties/{id}
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
  console.warn(`[DEPRECATED] POST /api/dashboard/properties/${propertyId}/update-details called. Migrate to PATCH /api/v1/properties/${propertyId}`)
  console.warn('  Sunset Date: 2026-02-05 (90 days from deprecation)')
  console.warn('  Migration Guide: Use PATCH /api/v1/properties/{id} instead of POST')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Create service role client to bypass RLS recursion
    const supabaseAdmin = createServiceRoleClient()

    // Verify property ownership using service role client
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

    // Build update object from allowed fields
    const allowedFields = [
      "address",
      "city",
      "state",
      "zip_code",
      "email",
      "phone",
      "description",
      "hero_image_url",
      "gallery_images",
      "check_in_time",
      "check_out_time",
      "timezone",
      "check_in_instructions",
      "check_out_instructions",
      "cancellation_policy",
      "house_rules",
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString()

    // Update property using service role client to bypass RLS
    const { data: updatedProperty, error: updateError } = await supabaseAdmin
      .from("properties")
      .update(updateData)
      .eq("id", propertyId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating property:", updateError)
      return NextResponse.json(
        { error: "Failed to update property" },
        { status: 500 }
      )
    }

    // Add deprecation headers (following RFC 8594)
    const response = NextResponse.json({
      success: true,
      property: updatedProperty,
    })
    response.headers.set('Deprecation', 'true')
    response.headers.set('Sunset', 'Wed, 05 Feb 2026 00:00:00 GMT')
    response.headers.set('Link', `</api/v1/properties/${propertyId}>; rel="alternate"`)
    response.headers.set(
      'Warning',
      '299 - "Deprecated API - Migrate to PATCH /api/v1/properties/{id} by 2026-02-05"'
    )

    return response
  } catch (error) {
    console.error("Error in update-details API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
