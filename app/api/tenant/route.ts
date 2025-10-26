import { NextResponse } from "next/server"
import { getTenantInfo } from "@/lib/tenant"
import { getPropertyBySubdomain } from "@/lib/supabase/tenant"

export async function GET() {
  try {
    const tenantInfo = await getTenantInfo()

    if (!tenantInfo.subdomain) {
      return NextResponse.json({
        subdomain: null,
        isMainSite: true,
        propertyId: null,
        propertyName: null,
      })
    }

    // Fetch property details from database
    const property = await getPropertyBySubdomain(tenantInfo.subdomain)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    return NextResponse.json({
      subdomain: tenantInfo.subdomain,
      isMainSite: false,
      propertyId: property.id,
      propertyName: property.name,
    })
  } catch (error) {
    console.error("[v0] Error in tenant API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
