import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { HousekeepingQueries } from '@/lib/dashboard/housekeeping/housekeeping-queries'
import { CreateHousekeepingTaskImageRequestSchema } from '@/types/api/v1/schemas/housekeeping'

/**
 * GET /api/v1/properties/[propertyId]/housekeeping/[housekeepingId]/images
 *
 * List task images for a housekeeping task.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; housekeepingId: string }> },
) {
  try {
    const { propertyId, housekeepingId } = await params
    console.info('[Housekeeping Images API] GET start', { propertyId, housekeepingId })
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
      permission: 'housekeeping.view_assigned',
    })
    if (isDenied(access)) return access

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const images = await queries.listTaskImages({
      propertyId,
      taskType: 'housekeeping',
      taskId: housekeepingId,
    })
    console.info('[Housekeeping Images API] GET success', {
      propertyId,
      housekeepingId,
      count: images.length,
    })

    return success({ images }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping Images API] GET failed', {
      message,
      err,
    })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * POST /api/v1/properties/[propertyId]/housekeeping/[housekeepingId]/images
 *
 * Register a new image attachment for a housekeeping task.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; housekeepingId: string }> },
) {
  try {
    const { propertyId, housekeepingId } = await params
    console.info('[Housekeeping Images API] POST start', { propertyId, housekeepingId })
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

    const body = await request.json()
    console.info('[Housekeeping Images API] POST payload received', {
      propertyId,
      housekeepingId,
      storagePath: body?.storagePath,
    })
    const parsed = CreateHousekeepingTaskImageRequestSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const image = await queries.createTaskImage({
      propertyId,
      taskType: 'housekeeping',
      taskId: housekeepingId,
      storagePath: parsed.data.storagePath,
      uploadedBy: user.id,
    })
    console.info('[Housekeeping Images API] POST success', {
      propertyId,
      housekeepingId,
      imageId: image.id,
      storagePath: image.storage_path,
    })

    return success({ image }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping Images API] POST failed', {
      message,
      err,
    })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
