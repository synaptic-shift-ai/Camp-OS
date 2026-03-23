/**
 * Guests Export (CSV)
 *
 * POST /api/v1/exports/guests
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { success, error } from "@/lib/api/response"
import { ErrorCodes } from "@/lib/api/errors"
import { getGuests, type GuestFilters } from "@/lib/dashboard/queries"

type ExportGuestsBody = {
  propertyId: string
  filters?: {
    search?: string | null
  }
}

async function assertUserOwnsProperty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string
): Promise<unknown> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error(ErrorCodes.AUTH_004.code)
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .single()

  if (companyError || !company) {
    throw new Error(ErrorCodes.RESOURCE_NOT_FOUND.code)
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, company_id, site_type_config")
    .eq("id", propertyId)
    .single()

  if (propertyError || !property || property.company_id !== company.id) {
    throw new Error(ErrorCodes.AUTH_003.code)
  }

  return property.site_type_config
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ExportGuestsBody> | null
    const propertyId = body?.propertyId
    const searchRaw = body?.filters?.search

    if (typeof propertyId !== "string" || propertyId.length === 0) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, "Invalid request body"),
        { status: ErrorCodes.VALIDATION_ERROR.status }
      )
    }

    const supabase = await createClient()
    let siteTypeConfig: unknown = null
    try {
      siteTypeConfig = await assertUserOwnsProperty(supabase, propertyId)
    } catch (authErr) {
      const code = authErr instanceof Error ? authErr.message : ErrorCodes.AUTH_004.code
      const errDef = Object.values(ErrorCodes).find((d: any) => d.code === code)
      const status = errDef?.status ?? 401
      return NextResponse.json(error({ code, message: errDef?.message ?? "Unauthorized", status }), { status })
    }

    const rawSiteTypeConfig = (siteTypeConfig ?? null) as { allowed_site_types?: string[] } | null
    const allowedSiteTypesFromConfig = Array.isArray(rawSiteTypeConfig?.allowed_site_types)
      ? rawSiteTypeConfig.allowed_site_types
      : []

    const allowedSiteTypes = allowedSiteTypesFromConfig
      .map((t) => t.toLowerCase().trim())
      .filter((t) => t.length > 0)

    const filters: GuestFilters = {
      search:
        typeof searchRaw === "string" && searchRaw.trim().length > 0
          ? searchRaw
          : undefined,
      ...(allowedSiteTypes.length > 0 ? { allowedSiteTypes } : {}),
    }

    // getGuests already aggregates and only paginates client-side slices.
    const { data: guests } = await getGuests(propertyId, filters, 1, Number.MAX_SAFE_INTEGER)
    return success(guests, request)
  } catch (err) {
    console.error("[Exports] guests export error:", err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, "Failed to export guests"),
      { status: ErrorCodes.INTERNAL_ERROR.status }
    )
  }
}

