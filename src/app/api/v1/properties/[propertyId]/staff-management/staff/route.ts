import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
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

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      minimumRole: 'manager',
    })
    if (isDenied(access)) return access

    const sp = request.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get('page')) || 1)
    const pageSize = Math.max(1, Number(sp.get('pageSize')) || 10)
    const search = sp.get('search') ?? ''
    const role = sp.get('role') ?? 'all'
    const category = sp.get('category') ?? 'all'
    const status = sp.get('status') ?? 'all'

    const q = new StaffManagementQueries(supabase as any)
    const admin = createServiceRoleClient()
    const result = await q.listStaffForManagementTablePaginated(propertyId, admin, {
      page,
      pageSize,
      search,
      role,
      category,
      status,
    })

    return success(result, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
