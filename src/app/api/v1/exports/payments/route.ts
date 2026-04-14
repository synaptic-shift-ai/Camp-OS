/**
 * Payments Export (CSV)
 *
 * POST /api/v1/exports/payments
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { success, error } from "@/lib/api/response"
import { ErrorCodes } from "@/lib/api/errors"
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { resolveModuleActionAccess } from "@/lib/dashboard/module-action-access"
import { getPayments } from "@/lib/dashboard/queries"

type ExportPaymentsBody = {
  propertyId: string
}

async function assertUserHasPropertyAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, propertyId: string) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error(ErrorCodes.AUTH_004.code)
  }

  const access = await requirePropertyAccess(supabase, user.id, {
    propertyId,
    minimumRole: 'staff',
    permission: 'financial.view_transactions',
  })
  if (isDenied(access)) {
    throw new Error(ErrorCodes.AUTH_003.code)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ExportPaymentsBody> | null
    const propertyId = body?.propertyId

    if (typeof propertyId !== "string" || propertyId.length === 0) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, "Invalid request body"),
        { status: ErrorCodes.VALIDATION_ERROR.status }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001), { status: 401 })
    }
    const paymentActions = await resolveModuleActionAccess({
      supabase,
      propertyId,
      userId: user.id,
      moduleKey: "payments",
      actions: ["export"] as const,
      fallbackForCategory: (role) => {
        if (role === "owner" || role === "admin") return { export: true }
        return { export: false }
      },
    })
    if (!paymentActions.export) {
      return NextResponse.json(error(ErrorCodes.AUTH_002, "Access denied"), { status: 403 })
    }
    try {
      await assertUserHasPropertyAccess(supabase, (await supabase.auth.getUser()).data!.user!.id, propertyId)
    } catch (authErr) {
      const code = authErr instanceof Error ? authErr.message : ErrorCodes.AUTH_004.code
      const errDef = Object.values(ErrorCodes).find((d: any) => d.code === code)
      const status = errDef?.status ?? 401
      return NextResponse.json(error({ code, message: errDef?.message ?? "Unauthorized", status }), { status })
    }

    // First call: resolve total count without downloading everything.
    const firstPage = await getPayments(propertyId, {}, 1, 1)
    if (!firstPage.total || firstPage.total <= 0) {
      return success([], request)
    }

    // Second call: pull all rows using computed total.
    const { data: payments } = await getPayments(propertyId, {}, 1, firstPage.total)
    return success(payments, request)
  } catch (err) {
    console.error("[Exports] payments export error:", err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, "Failed to export payments"),
      { status: ErrorCodes.INTERNAL_ERROR.status }
    )
  }
}

