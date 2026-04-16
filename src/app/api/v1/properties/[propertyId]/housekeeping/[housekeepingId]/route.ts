import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { HousekeepingQueries } from '@/lib/dashboard/housekeeping/housekeeping-queries'
import { UpdateHousekeepingTaskRequestSchema } from '@/types/api/v1/schemas/housekeeping'

/**
 * PATCH /api/v1/properties/[propertyId]/housekeeping/[housekeepingId]
 *
 * Update a housekeeping task for the property.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; housekeepingId: string }> },
) {
  try {
    const { propertyId, housekeepingId } = await params
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
    const parsed = UpdateHousekeepingTaskRequestSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const housekeepingTask = await queries.updateHousekeepingTask({
      id: housekeepingId,
      propertyId,
      ...(parsed.data.siteId !== undefined ? { siteId: parsed.data.siteId } : {}),
      ...(parsed.data.staffId !== undefined ? { staffId: parsed.data.staffId } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    })

    return success({ housekeepingTask }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping API v1] PATCH error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * DELETE /api/v1/properties/[propertyId]/housekeeping/[housekeepingId]
 *
 * Delete a housekeeping task for the property.
 */

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ propertyId: string; housekeepingId: string }> }
) {
    try {
        const { propertyId, housekeepingId } = await params
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
            permission: 'housekeeping.reassign',
        })
        if (isDenied(access)) return access

        const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
        await queries.deleteHousekeepingTask({ id: housekeepingId, propertyId })

        return success({ deleted: true }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Housekeeping API v1] DELETE error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}