import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { HousekeepingQueries } from '@/lib/dashboard/housekeeping/housekeeping-queries'
import { CreateChecklistRequestSchema } from '@/types/api/v1/schemas/housekeeping'

function housekeepingFallbackForCategory(
  role: 'owner' | 'admin' | 'manager' | 'staff',
  categoryName: string,
): Record<string, boolean> {
  if (role === 'owner' || role === 'admin') return { view: true, create: true, update: true, delete: true }
  const category = categoryName.trim().toLowerCase()
  if (role === 'manager' && category === 'housekeeping') {
    return { view: true, create: true, update: true, delete: true }
  }
  if (role === 'staff' && category === 'housekeeping') {
    return { view: true, create: false, update: false, delete: false }
  }
  return { view: false, create: false, update: false, delete: false }
}

/**
 * POST /api/v1/properties/[propertyId]/housekeeping/checklists
 *
 * Create a checklist template for the property.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params
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
      permission: 'housekeeping.create_manual',
    })
    if (isDenied(access)) return access

    const actionAccess = await resolveModuleActionAccess({
      supabase: supabase as SupabaseClient,
      propertyId,
      userId: user.id,
      moduleKey: 'housekeeping',
      actions: ['create'],
      fallbackForCategory: housekeepingFallbackForCategory,
    })
    if (!actionAccess.create) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to create housekeeping checklists.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const body = await request.json()
    const parsed = CreateChecklistRequestSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const checklist = await queries.createPropertyChecklist({
      propertyId,
      createdBy: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      items: parsed.data.items.map((row) => ({
        label: row.label,
        notes: row.notes ?? null,
      })),
    })

    if (access.companyId) {
      const service = createServiceRoleClient()
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'create',
          resource: 'housekeeping',
          userId: user.id,
          details: `Created checklist template "${checklist.name}".`,
        },
        { failOpen: false },
      )
    }

    return success({ checklist }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping checklists API v1] POST error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
