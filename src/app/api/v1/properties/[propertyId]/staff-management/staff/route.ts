import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const q = new StaffManagementQueries(supabase as any)
    const { hasAccess } = await q.verifyPropertyAccess({
      propertyId,
      userId: user.id,
    })

    if (!hasAccess) {
      return error(ErrorCodes.AUTH_002, request)
    }

    const admin = createServiceRoleClient()
    const staff = await q.listStaffForManagementTable(propertyId, admin)

    return success({ staff }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
