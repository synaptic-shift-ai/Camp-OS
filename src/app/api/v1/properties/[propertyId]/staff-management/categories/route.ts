import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'

const categoryNameRowSchema = z.object({ name: z.string().trim().min(1) })

const BodySchema = z.object({
  categoriesByRole: z.object({
    owner: z.array(categoryNameRowSchema).optional(),
    admin: z.array(categoryNameRowSchema),
    manager: z.array(categoryNameRowSchema),
    staff: z.array(categoryNameRowSchema),
  }),
})

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
        'Role categories require an elevated property role (owner, admin, property_admin, or manager).',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const result = await q.getPropertyRoleCategories({
      propertyId,
    })

    return success(result, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      console.error('[StaffManagementCategories] Unauthorized', {
        propertyId,
        authError: authError?.message ?? null,
      })
      return error(ErrorCodes.AUTH_001, request)
    }

    const q = new StaffManagementQueries(supabase as any)
    const { hasAccess, isAdmin } = await q.verifyPropertyAccess({
      propertyId,
      userId: user.id,
    })

    if (!hasAccess) {
      console.error('[StaffManagementCategories] Forbidden - no access', {
        propertyId,
        userId: user.id,
      })
      return error(
        ErrorCodes.AUTH_002.code,
        'No access to this property. Confirm the property ID and your assignment or company ownership.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    if (!isAdmin) {
      console.error('[StaffManagementCategories] Forbidden - admin required', {
        propertyId,
        userId: user.id,
      })
      return error(
        ErrorCodes.AUTH_002.code,
        'Saving role categories requires an elevated property role (owner, admin, property_admin, or manager).',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const parsed = BodySchema.safeParse(await request.json())
    if (!parsed.success) {
      console.error('[StaffManagementCategories] Validation error', {
        propertyId,
        userId: user.id,
        errors: parsed.error.errors,
      })
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.errors,
      })
    }

    const incoming = parsed.data.categoriesByRole
    let categoriesByRole: {
      owner: { name: string }[]
      admin: { name: string }[]
      manager: { name: string }[]
      staff: { name: string }[]
    }
    if (incoming.owner !== undefined) {
      categoriesByRole = {
        owner: incoming.owner,
        admin: incoming.admin,
        manager: incoming.manager,
        staff: incoming.staff,
      }
    } else {
      const current = await q.getPropertyRoleCategories({ propertyId })
      categoriesByRole = {
        owner: current.categoriesByRole.owner.map((c) => ({ name: c.name })),
        admin: incoming.admin,
        manager: incoming.manager,
        staff: incoming.staff,
      }
    }

    const result = await q.savePropertyRolesCategories({
      propertyId,
      categoriesByRole,
    })

    return success(result, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[StaffManagementCategories] Save failed', {
      message,
      err,
    })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}