import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    const requiredFields = ["name", "address", "city", "state", "zipCode", "phone", "email"]
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    // Validate state is 2 characters
    if (body.state.length !== 2) {
      return NextResponse.json({ error: "State must be 2 characters" }, { status: 400 })
    }

    // Validate zip code is at least 5 characters
    if (body.zipCode.length < 5) {
      return NextResponse.json({ error: "Zip code must be at least 5 characters" }, { status: 400 })
    }

    // Validate phone is at least 10 characters
    if (body.phone.length < 10) {
      return NextResponse.json({ error: "Phone number must be at least 10 characters" }, { status: 400 })
    }

    // Check if user already has a property
    const { data: existingProperty } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    const supabaseServiceRole = createServiceRoleClient()

    let property

    if (existingProperty) {
      // Update existing property
      const { data, error } = await supabaseServiceRole
        .from("properties")
        .update({
          name: body.name,
          description: body.description || "",
          address: body.address,
          city: body.city,
          state: body.state,
          zip_code: body.zipCode,
          phone: body.phone,
          email: body.email,
        })
        .eq("id", existingProperty.id)
        .eq("owner_id", user.id) // Tenant isolation
        .select()
        .single()

      if (error) {
        console.error("[Onboarding] Failed to update property:", error)
        return NextResponse.json({ error: "Failed to update property information" }, { status: 500 })
      }

      property = data
    } else {
      // Create new property
      // Generate URL-friendly slug from property name
      const slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) // Limit length

      const { data, error } = await supabaseServiceRole
        .from("properties")
        .insert({
          owner_id: user.id,
          name: body.name,
          slug: slug,
          description: body.description || "",
          address: body.address,
          city: body.city,
          state: body.state,
          zip_code: body.zipCode,
          phone: body.phone,
          email: body.email,
          onboarding_completed: false,
        })
        .select()
        .single()

      if (error) {
        console.error("[Onboarding] Failed to create property:", error)
        return NextResponse.json({ error: "Failed to create property" }, { status: 500 })
      }

      property = data
    }

    return NextResponse.json(
      {
        success: true,
        message: "Property information saved successfully",
        data: {
          id: property.id,
          name: property.name,
          address: property.address,
          city: property.city,
          state: property.state,
          zipCode: property.zip_code,
          phone: property.phone,
          email: property.email,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[Onboarding] Error saving property information:", error)
    return NextResponse.json({ error: "Failed to save property information" }, { status: 500 })
  }
}
