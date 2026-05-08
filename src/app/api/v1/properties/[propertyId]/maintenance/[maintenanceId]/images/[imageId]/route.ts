import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { success, error } from "@/lib/api/response"
import { ErrorCodes } from "@/lib/api/errors"
import { requirePropertyAccess, isDenied } from "@/lib/rbac"
import { HousekeepingQueries } from "@/lib/dashboard/housekeeping/housekeeping-queries"

const TASK_ATTACHMENTS_BUCKET = "maintenance-and-housekeeping-images"

/**
 * DELETE /api/v1/properties/[propertyId]/maintenance/[maintenanceId]/images/[imageId]
 *
 * Delete a maintenance task image attachment (regular or invoice).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; maintenanceId: string; imageId: string }> },
) {
  try {
    const { propertyId, maintenanceId, imageId } = await params
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

    // Try both maintenance task types to find the image
    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    let storagePath: string | null = null

    for (const taskType of ["maintenance", "maintenance_invoice"] as const) {
      try {
        const result = await queries.deleteTaskImage({
          propertyId,
          taskType,
          taskId: maintenanceId,
          imageId,
        })
        storagePath = result.storagePath
        break
      } catch {
        // Image not found under this task type, try the next
      }
    }

    if (!storagePath) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        message: "Image not found for this maintenance task.",
      })
    }

    const serviceRole = createServiceRoleClient()
    const { error: storageDeleteError } = await serviceRole.storage
      .from(TASK_ATTACHMENTS_BUCKET)
      .remove([storagePath])

    if (storageDeleteError) {
      console.error("[Maintenance Images API] DELETE storage remove failed", {
        propertyId,
        maintenanceId,
        imageId,
        bucket: TASK_ATTACHMENTS_BUCKET,
        storagePath,
        message: storageDeleteError.message,
      })
      // Image record was deleted from DB but storage cleanup failed — report partial success
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: storageDeleteError.message })
    }

    return success({ deleted: true }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[Maintenance Images API] DELETE failed", {
      message,
      err,
    })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
