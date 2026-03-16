import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { updatePropertyConfigSchema } from "@/lib/config/schemas"

/**
 * PATCH /api/properties/[id]/settings
 * Update property configuration settings
 *
 * Accepts partial updates for:
 * - deposit_config
 * - pricing_config
 * - booking_rules_config
 * - rate_discounts_config
 * - site_type_config
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId } = await params
    const body = await request.json()

    // Validate request body with Zod schema
    const validationResult = updatePropertyConfigSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid configuration data",
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const configUpdates = validationResult.data

    // Create service role client to bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Verify property exists and get company_id
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, company_id")
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // Verify user owns the property through company ownership
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, owner_id")
      .eq("id", property.company_id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    if (company.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized - You do not own this property" },
        { status: 403 }
      )
    }

    // Build update object with only provided config fields
    const updateData: Record<string, unknown> = {}

    if (configUpdates.deposit_config !== undefined) {
      updateData.deposit_config = configUpdates.deposit_config
    }

    if (configUpdates.pricing_config !== undefined) {
      updateData.pricing_config = configUpdates.pricing_config
    }

    if (configUpdates.booking_rules_config !== undefined) {
      updateData.booking_rules_config = configUpdates.booking_rules_config
    }

    if (configUpdates.rate_discounts_config !== undefined) {
      updateData.rate_discounts_config = configUpdates.rate_discounts_config
    }

    if (configUpdates.site_type_config !== undefined) {
      updateData.site_type_config = configUpdates.site_type_config
    }

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString()

    // Update property using service role client
    const { data: updatedProperty, error: updateError } = await supabaseAdmin
      .from("properties")
      .update(updateData)
      .eq("id", propertyId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating property settings:", updateError)
      return NextResponse.json(
        { error: "Failed to update property settings" },
        { status: 500 }
      )
    }

    // Revalidate the settings page to reflect changes immediately
    revalidatePath('/dashboard/settings')

    return NextResponse.json({
      success: true,
      property: updatedProperty,
    })
  } catch (error) {
    console.error("Error in PATCH /api/properties/[id]/settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/properties/[id]/settings
 * Retrieve property configuration settings
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId } = await params

    // Create service role client to bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Get property with all config fields
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select(`
        id,
        name,
        company_id,
        deposit_config,
        pricing_config,
        booking_rules_config,
        rate_discounts_config,
        site_type_config
      `)
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // Verify user owns the property through company ownership
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, owner_id")
      .eq("id", property.company_id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    if (company.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized - You do not own this property" },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      property,
    })
  } catch (error) {
    console.error("Error in GET /api/properties/[id]/settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
