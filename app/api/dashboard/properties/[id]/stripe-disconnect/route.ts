import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId } = await params

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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in stripe-disconnect API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
