import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { success, error } from "@/lib/api/response"
import { ErrorCodes } from "@/lib/api/errors"
import { requirePropertyAccess, isDenied } from "@/lib/rbac"
import { HousekeepingQueries } from "@/lib/dashboard/housekeeping/housekeeping-queries"
import { CreateHousekeepingTaskImageRequestSchema } from "@/types/api/v1/schemas/housekeeping"

type MaintenanceTaskType = "maintenance" | "maintenance_invoice"

function isValidMaintenanceTaskType(value: string | null | undefined): value is MaintenanceTaskType {
  return value === "maintenance" || value === "maintenance_invoice"
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; maintenanceId: string }> },
) {
  try {
    const { propertyId, maintenanceId } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      permission: "maintenance.view_assigned",
    })
    if (isDenied(access)) return access

    const { searchParams } = new URL(request.url)
    const taskTypeParam = searchParams.get("task_type")

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const listInput: { propertyId: string; taskType?: "maintenance" | "maintenance_invoice"; taskId: string } = {
      propertyId,
      taskId: maintenanceId,
    }
    if (isValidMaintenanceTaskType(taskTypeParam)) {
      listInput.taskType = taskTypeParam
    }
    const images = await queries.listTaskImages(listInput)

    return success({ images }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; maintenanceId: string }> },
) {
  try {
    const { propertyId, maintenanceId } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      permission: "maintenance.create_wo",
    })
    if (isDenied(access)) return access

    const body = await request.json()
    const parsed = CreateHousekeepingTaskImageRequestSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const taskType = isValidMaintenanceTaskType(parsed.data.taskType)
      ? parsed.data.taskType
      : "maintenance"

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const image = await queries.createTaskImage({
      propertyId,
      taskType,
      taskId: maintenanceId,
      storagePath: parsed.data.storagePath,
      uploadedBy: user.id,
    })

    return success({ image }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
