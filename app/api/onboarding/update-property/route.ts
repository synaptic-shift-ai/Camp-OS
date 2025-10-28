import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"

const propertyUpdateSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(1, "Property name is required"),
  description: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z
    .string()
    .length(2, "State must be 2 characters")
    .transform((val) => val.toUpperCase()),
  zipCode: z.string().min(5, "Zip code is required"),
  phone: z.string().min(10, "Phone number is required"),
  email: z.string().email("Invalid email address"),
  markComplete: z.boolean().optional().default(false),
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
    const validatedData = propertyUpdateSchema.parse(body)

    // Create service role client (bypasses RLS to avoid recursion)
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Verify property belongs to user's company
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, company_id, companies!inner(owner_id)")
      .eq("id", validatedData.propertyId)
      .single()

    if (propertyError || !property) {
      console.error("Property lookup error:", propertyError)
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // @ts-expect-error - Type issue with nested select
    if (property.companies?.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update property using service role (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({
        name: validatedData.name,
        description: validatedData.description,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zip_code: validatedData.zipCode,
        phone: validatedData.phone,
        email: validatedData.email,
        ...(validatedData.markComplete && { onboarding_completed: true }),
      })
      .eq("id", validatedData.propertyId)

    if (updateError) {
      console.error("Error updating property:", updateError)
      return NextResponse.json({ error: "Failed to update property" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 })
    }

    console.error("Update property API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
