import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: propertyId } = await params

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

    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({
        wizard_progress: updatedProgress,
        wizard_step_completed: step,
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

    return NextResponse.json({
      success: true,
      progress: updatedProgress,
    })
  } catch (error) {
    console.error("Error in wizard-progress API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
