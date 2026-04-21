import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { HousekeepingQueries } from '@/lib/dashboard/housekeeping/housekeeping-queries'

const TASK_ATTACHMENTS_BUCKET = 'maintenance-and-housekeeping-images'

/**
 * DELETE /api/v1/properties/[propertyId]/housekeeping/[housekeepingId]/images/[imageId]
 *
 * Delete a housekeeping task image attachment.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; housekeepingId: string; imageId: string }> },
) {
  try {
    const { propertyId, housekeepingId, imageId } = await params
    console.info('[Housekeeping Images API] DELETE start', { propertyId, housekeepingId, imageId })
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
      permission: 'housekeeping.start_complete',
    })
    if (isDenied(access)) return access

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const { storagePath } = await queries.deleteTaskImage({
      propertyId,
      taskType: 'housekeeping',
      taskId: housekeepingId,
      imageId,
    })

    const serviceRole = createServiceRoleClient()
    const { error: storageDeleteError } = await serviceRole.storage
      .from(TASK_ATTACHMENTS_BUCKET)
      .remove([storagePath])

    if (storageDeleteError) {
      console.error('[Housekeeping Images API] DELETE storage remove failed', {
        propertyId,
        housekeepingId,
        imageId,
        bucket: TASK_ATTACHMENTS_BUCKET,
        storagePath,
        message: storageDeleteError.message,
      })
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: storageDeleteError.message })
    }

    console.info('[Housekeeping Images API] DELETE success', {
      propertyId,
      housekeepingId,
      imageId,
      bucket: TASK_ATTACHMENTS_BUCKET,
      storagePath,
    })
    return success({ deleted: true }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping Images API] DELETE failed', {
      message,
      err,
    })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
