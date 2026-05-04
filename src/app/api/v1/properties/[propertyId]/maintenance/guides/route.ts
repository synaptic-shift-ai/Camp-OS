import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'
import { CreateMaintenanceGuideSchema } from '@/types/api/v1/schemas/maintenance'

function maintenanceFallbackForCategory(
  role: 'owner' | 'admin' | 'manager' | 'staff',
  categoryName: string,
): Record<string, boolean> {
  if (role === 'owner' || role === 'admin') return { view: true, create: true, update: true, delete: true }
  const category = categoryName.trim().toLowerCase()
  if (role === 'manager' && category === 'maintenance') {
    return { view: true, create: true, update: true, delete: true }
  }
  if (role === 'staff' && category === 'maintenance') {
    return { view: true, create: false, update: false, delete: false }
  }
  return { view: false, create: false, update: false, delete: false }
}

/**
 * GET /api/v1/properties/[propertyId]/maintenance/guides
 *
 * List all maintenance guides for the property.
 */
export async function GET(
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
      permission: 'maintenance.view_assigned',
    })
    if (isDenied(access)) return access

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const guides = await queries.listMaintenanceGuides(propertyId)

    return success({ guides }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance guides API v1] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * POST /api/v1/properties/[propertyId]/maintenance/guides
 *
 * Create a maintenance guide for the property.
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
      permission: 'maintenance.create_wo',
    })
    if (isDenied(access)) return access

    const actionAccess = await resolveModuleActionAccess({
      supabase: supabase as SupabaseClient,
      propertyId,
      userId: user.id,
      moduleKey: 'maintenance',
      actions: ['create'],
      fallbackForCategory: maintenanceFallbackForCategory,
    })
    if (!actionAccess.create) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to create maintenance guides.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const body = await request.json()
    const parsed = CreateMaintenanceGuideSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const guide = await queries.createMaintenanceGuide({
      propertyId,
      createdBy: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      steps: parsed.data.steps.map((step) => ({
        id: step.id,
        label: step.label,
        notes: step.notes ?? null,
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
          resource: 'maintenance',
          userId: user.id,
          details: `Created maintenance guide "${guide.name}".`,
        },
        { failOpen: false },
      )
    }

    return success({ guide }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance guides API v1] POST error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
