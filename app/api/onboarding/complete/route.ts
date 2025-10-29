import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { z } from "zod"

const completeSchema = z.object({
  propertyId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
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

    // Verify property ownership
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, owner_id")
      .eq("id", validatedData.propertyId)
      .single()

    if (propertyError || !property) {
      console.error("Property lookup error:", propertyError)
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (property.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Mark onboarding as complete
    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validatedData.propertyId)

    if (updateError) {
      console.error("Error completing onboarding:", updateError)
      return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 })
    }

    console.error("Complete onboarding API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
