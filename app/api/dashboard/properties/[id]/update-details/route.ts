import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const propertyId = params.id
    const body = await request.json()

    // Verify property ownership
    const { data: property, error: propertyError } = await supabase
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

    // Update property
    const { data: updatedProperty, error: updateError } = await supabase
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

    return NextResponse.json({
      success: true,
      property: updatedProperty,
    })
  } catch (error) {
    console.error("Error in update-details API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
