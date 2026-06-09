import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import {
  resolveDashboardAccess,
  canManageStaffAccess,
  canManageStaffRoster,
  canViewStaffRoster,
} from '@/lib/rbac/dashboard-guards'
import { fetchCategoryDerivedPermissionKeys } from '@/lib/rbac/role-category-module-access'
import type { PermissionKey } from '@/lib/rbac/permissions'

const STAFF_ACCESS_MANAGEMENT_KEY: PermissionKey = 'global.manage_staff_module_access'

const categoryNameRowSchema = z.object({ name: z.string().trim().min(1) })

const BodySchema = z.object({
  categoriesByRole: z.object({
    owner: z.array(categoryNameRowSchema).optional(),
    admin: z.array(categoryNameRowSchema),
    manager: z.array(categoryNameRowSchema),
    staff: z.array(categoryNameRowSchema),
  }),
})

const AccessSchema = z.object({
  selectedModuleKey: z.string().trim().min(1),
  moduleAccessControl: z.record(z.record(z.boolean())),
})

const PatchBodySchema = z.object({
  categoryId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'manager', 'staff']),
  access: AccessSchema,
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
    const access = await resolveDashboardAccess(supabase as never, propertyId, user.id)

    if (!access) {
      return error(
        ErrorCodes.AUTH_002.code,
        'No access to this property. Confirm the property ID and your assignment or company ownership.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const categoryDerived = await fetchCategoryDerivedPermissionKeys(
      supabase as never,
      propertyId,
      user.id,
      access.rawRole,
    )
    const canLoadRoleAccessDialog = categoryDerived.has(STAFF_ACCESS_MANAGEMENT_KEY)

    if (!canViewStaffRoster(access) && !canLoadRoleAccessDialog) {
      return error(
        ErrorCodes.AUTH_002.code,
        'Role categories require an elevated property role (owner, admin, property_admin, or manager), or delegated staff access management permission.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    let result = await q.getPropertyRoleCategories({
      propertyId,
    })

    // Safety-net: auto-seed default role categories if none exist yet
    const totalCategories = Object.values(result.categoriesByRole).reduce(
      (sum, arr) => sum + arr.length,
      0,
    )
    if (totalCategories === 0) {
      try {
        const { seedDefaultPropertyRoleCategoriesIfEmpty } = await import(
          '@/lib/dashboard/seed-default-property-role-categories'
        )
        const serviceRoleSupabase = createServiceRoleClient()
        await seedDefaultPropertyRoleCategoriesIfEmpty(serviceRoleSupabase, propertyId)
        result = await q.getPropertyRoleCategories({ propertyId })
      } catch (seedErr) {
        console.error(
          '[Categories GET] Failed to auto-seed default role categories:',
          seedErr,
        )
        // Non-blocking — return empty categories rather than fail the request
      }
    }

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
    const access = await resolveDashboardAccess(supabase as never, propertyId, user.id)

    if (!access) {
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

    if (!canManageStaffRoster(access)) {
      console.error('[StaffManagementCategories] Forbidden - admin required', {
        propertyId,
        userId: user.id,
      })
      return error(
        ErrorCodes.AUTH_002.code,
        'Saving role categories requires an admin-level property role (owner, admin, or property_admin).',
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

    const service = createServiceRoleClient()
    const adminQueries = new StaffManagementQueries(service as any)

    const result = await adminQueries.savePropertyRolesCategories({
      propertyId,
      categoriesByRole,
    })

    if (access.companyId) {
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'create',
          resource: 'role_category',
          userId: user.id,
          details: 'Saved staff role categories.',
        },
        { failOpen: false },
      )
    }

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const q = new StaffManagementQueries(supabase as any)
    const access = await resolveDashboardAccess(supabase as never, propertyId, user.id)

    if (!access) {
      return error(
        ErrorCodes.AUTH_002.code,
        'No access to this property. Confirm the property ID and your assignment or company ownership.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const categoryDerived = await fetchCategoryDerivedPermissionKeys(
      supabase as never,
      propertyId,
      user.id,
      access.rawRole,
    )
    const canSaveRoleAccess = categoryDerived.has(STAFF_ACCESS_MANAGEMENT_KEY)

    if (!canManageStaffAccess(access) && !canSaveRoleAccess) {
      return error(
        ErrorCodes.AUTH_002.code,
        'Saving role access requires a property owner or delegated staff access management permission.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const parsed = PatchBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.errors,
      })
    }

    const service = createServiceRoleClient()
    const adminQueries = new StaffManagementQueries(service as any)

    await adminQueries.savePropertyRoleCategoryAccess({
      propertyId,
      categoryId: parsed.data.categoryId,
      role: parsed.data.role,
      access: parsed.data.access,
    })

    if (access.companyId) {
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'update',
          resource: 'role_access',
          userId: user.id,
          details: `Updated access for role category ${parsed.data.role}.`,
        },
        { failOpen: false },
      )
    }

    return success({ saved: true }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}