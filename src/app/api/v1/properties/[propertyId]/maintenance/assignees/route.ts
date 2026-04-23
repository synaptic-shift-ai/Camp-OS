import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'

type AssigneeOption = {
  id: string
  label: string
}

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

    const { data: staffCategories, error: categoriesError } = await supabase
      .from('property_role_categories')
      .select('id, name')
      .eq('property_id', propertyId)
      .eq('role', 'staff')

    if (categoriesError) {
      throw new Error(`Failed to load staff role categories: ${categoriesError.message}`)
    }

    const maintenanceCategoryIds = (staffCategories ?? [])
      .filter((category) => category.name.trim().toLowerCase() === 'maintenance')
      .map((category) => category.id as string)

    if (maintenanceCategoryIds.length === 0) {
      return success({ assigneeOptions: [] }, request)
    }

    const { data: maintenanceStaff, error: staffError } = await supabase
      .from('property_staff')
      .select('id, user_id')
      .eq('property_id', propertyId)
      .eq('role', 'staff')
      .eq('status', 'active')
      .overlaps('role_category_id', maintenanceCategoryIds)

    if (staffError) {
      throw new Error(`Failed to load maintenance staff: ${staffError.message}`)
    }

    const serviceClient = createServiceRoleClient()
    const assigneeOptions = (
      await Promise.all(
        (maintenanceStaff ?? []).map(async (staffRow) => {
          if (!staffRow.user_id) return null
          const { data, error: userError } = await serviceClient.auth.admin.getUserById(staffRow.user_id)
          if (userError || !data.user) return null

          const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>
          const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : ''
          const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : ''
          const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : ''
          const fallbackName = [firstName, lastName].filter(Boolean).join(' ').trim()
          const displayName = fullName || fallbackName || data.user.email || 'Staff member'

          const option: AssigneeOption = {
            id: staffRow.id as string,
            label: displayName,
          }
          return option
        }),
      )
    )
      .filter((option): option is AssigneeOption => Boolean(option))
      .sort((a, b) => a.label.localeCompare(b.label))

    return success({ assigneeOptions }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance Assignees API] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
