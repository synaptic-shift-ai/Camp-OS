/**
 * Reservations Export (CSV)
 *
 * POST /api/v1/exports/reservations
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { success, error } from "@/lib/api/response"
import { ErrorCodes } from "@/lib/api/errors"
import { getReservations, type ReservationFilters } from "@/lib/dashboard/queries"

type ExportReservationsBody = {
  propertyId: string
  filters?: {
    siteType?: string | null
  }
}

async function assertUserOwnsProperty(supabase: Awaited<ReturnType<typeof createClient>>, propertyId: string) {
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
    .select("id, company_id")
    .eq("id", propertyId)
    .single()

  if (propertyError || !property || property.company_id !== company.id) {
    throw new Error(ErrorCodes.AUTH_003.code)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ExportReservationsBody> | null
    const propertyId = body?.propertyId
    const siteTypeRaw = body?.filters?.siteType

    if (typeof propertyId !== "string" || propertyId.length === 0) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, "Invalid request body", {
          message: "propertyId is required",
        }),
        { status: ErrorCodes.VALIDATION_ERROR.status }
      )
    }

    const supabase = await createClient()
    try {
      await assertUserOwnsProperty(supabase, propertyId)
    } catch (authErr) {
      const code = authErr instanceof Error ? authErr.message : ErrorCodes.AUTH_004.code
      const errDef = Object.values(ErrorCodes).find((d: any) => d.code === code)
      const status = errDef?.status ?? 401
      return NextResponse.json(error({ code, message: errDef?.message ?? "Unauthorized", status }), { status })
    }

    const filters: ReservationFilters = {}
    if (typeof siteTypeRaw === "string" && siteTypeRaw.length > 0 && siteTypeRaw !== "all") {
      filters.siteType = siteTypeRaw
    }

    // First call: get total without pulling all rows immediately.
    const firstPage = await getReservations(propertyId, filters, 1, 1)
    if (!firstPage.total || firstPage.total <= 0) {
      return success([], request)
    }

    // Second call: pull all rows using the computed total.
    const { data: reservations } = await getReservations(propertyId, filters, 1, firstPage.total)
    return success(reservations, request)
  } catch (err) {
    console.error("[Exports] reservations export error:", err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, "Failed to export reservations"),
      { status: ErrorCodes.INTERNAL_ERROR.status }
    )
  }
}

