import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"

/**
 * PATCH /api/admin/sites/[id]
 * Update an existing site
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

    const { id: siteId } = await params
    const body = await request.json()

    // Create service role client to bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Verify site exists and get property_id
    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id, property_id")
      .eq("id", siteId)
      .single()

    if (siteError || !site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    // Verify property ownership through company
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, company_id")
      .eq("id", site.property_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, owner_id")
      .eq("id", property.company_id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    if (company.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Build update object from allowed fields
    const allowedFields = [
      "site_number",
      "site_name",
      "site_type",
      "max_occupancy",
      "max_vehicles",
      "size_sqft",
      "status",
      "description",
      "base_price",
      "weekend_price",
      "hookups",
      "site_amenities",
      "site_images",
      "availability_rules",
      "accessibility_features",
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString()

    // Update site using service role client
    const { data: updatedSite, error: updateError } = await supabaseAdmin
      .from("sites")
      .update(updateData)
      .eq("id", siteId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating site:", updateError)
      return NextResponse.json(
        { error: "Failed to update site" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      site: updatedSite,
    })
  } catch (error) {
    console.error("Error in PATCH /api/admin/sites/[id]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/sites/[id]
 * Delete a site (only if no future reservations)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: siteId } = await params

    // Create service role client to bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Verify site exists and get property_id
    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id, property_id")
      .eq("id", siteId)
      .single()

    if (siteError || !site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    // Verify property ownership through company
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, company_id")
      .eq("id", site.property_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, owner_id")
      .eq("id", property.company_id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    if (company.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check for active or future reservations
    const { data: reservations, error: reservationsError } = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("site_id", siteId)
      .not("status", "in", '("cancelled","no_show")')
      .gte("check_out_date", new Date().toISOString().split("T")[0])

    if (reservationsError) {
      console.error("Error checking reservations:", reservationsError)
      return NextResponse.json(
        { error: "Failed to check reservations" },
        { status: 500 }
      )
    }

    if (reservations && reservations.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete site with active or future reservations" },
        { status: 400 }
      )
    }

    // Delete site using service role client
    const { error: deleteError } = await supabaseAdmin
      .from("sites")
      .delete()
      .eq("id", siteId)

    if (deleteError) {
      console.error("Error deleting site:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete site" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Site deleted successfully",
    })
  } catch (error) {
    console.error("Error in DELETE /api/admin/sites/[id]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
