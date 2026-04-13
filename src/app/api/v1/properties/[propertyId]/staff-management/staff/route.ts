import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const q = new StaffManagementQueries(supabase as any)
    const { hasAccess, isAdmin } = await q.verifyPropertyAccess({
      propertyId,
      userId: user.id,
    })

    if (!hasAccess) {
      return error(
        ErrorCodes.AUTH_002.code,
        'No access to this property. Confirm the property ID and your assignment or company ownership.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    if (!isAdmin) {
      return error(
        ErrorCodes.AUTH_002.code,
        'Viewing the staff list requires an elevated property role (owner, admin, property_admin, or manager).',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const admin = createServiceRoleClient()
    const staff = await q.listStaffForManagementTable(propertyId, admin)

    return success({ staff }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
