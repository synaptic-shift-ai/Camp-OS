import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'

const BodySchema = z.object({
  categoriesByRole: z.object({
    owner: z.array(z.object({ name: z.string().trim().min(1) })),
    admin: z.array(z.object({ name: z.string().trim().min(1) })),
    manager: z.array(z.object({ name: z.string().trim().min(1) })),
    staff: z.array(z.object({ name: z.string().trim().min(1) })),
  }),
})

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
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

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
      return error(ErrorCodes.AUTH_002, request)
    }

    if (!isAdmin) {
      console.error('[StaffManagementCategories] Forbidden - admin required', {
        propertyId,
        userId: user.id,
      })
      return error(ErrorCodes.AUTH_002, request)
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

    const result = await q.savePropertyRolesCategories({
      propertyId,
      categoriesByRole: parsed.data.categoriesByRole,
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