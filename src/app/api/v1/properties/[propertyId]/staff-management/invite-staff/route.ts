import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'

const BodySchema = z.object({
  email: z.string().trim().email(),
  roleCategoryId: z.string().uuid(),
  status: z.enum(['pending', 'active', 'inactive']).optional(),
  categories: z.array(z.string()).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[StaffManagementInviteStaff] Unauthorized', {
        propertyId,
        authError: authError?.message ?? null,
      })
      return error(ErrorCodes.AUTH_001, request)
    }

    const parsed = BodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.errors,
      })
    }

    const q = new StaffManagementQueries(supabase as any)
    const { hasAccess, isAdmin } = await q.verifyPropertyAccess({
      propertyId,
      userId: user.id,
    })

    if (!hasAccess) {
      return error(ErrorCodes.AUTH_002, request)
    }

    if (!isAdmin) {
      return error(ErrorCodes.AUTH_003, request)
    }

    // Resolve roleCategoryId -> role string (and validate it belongs to this property)
    const { data: roleCategory, error: roleCategoryError } = await supabase
      .from('property_role_categories')
      .select('id, role')
      .eq('property_id', propertyId)
      .eq('id', parsed.data.roleCategoryId)
      .single()

    if (roleCategoryError || !roleCategory) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        message: 'Invalid roleCategoryId for this property',
      })
    }

    // Resolve email -> userId using service role (auth admin API)
    const service = createServiceRoleClient()
    const { data: usersData, error: listError } = await service.auth.admin.listUsers({
      perPage: 500,
    })

    if (listError) {
      console.error('[StaffManagementInviteStaff] Failed to list users', {
        message: listError.message,
      })
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: listError.message })
    }

    const found = usersData.users.find(
      (u) => (u.email ?? '').toLowerCase() === parsed.data.email.toLowerCase()
    )

    if (!found?.id) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, {
        message: 'User not found',
      })
    }

    const result = await q.inviteStaff({
      propertyId,
      userId: found.id,
      role: roleCategory.role,
      roleCategoryId: roleCategory.id,
      status: parsed.data.status ?? 'pending',
    })

    return success(result, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[StaffManagementInviteStaff] Invite failed', { message, err })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}