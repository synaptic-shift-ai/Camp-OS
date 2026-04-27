import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { resolveUserPropertyAccessOrThrow, AccessDeniedError } from '@/lib/rbac'
import { getPermissionsForRole } from '@/lib/rbac/permissions'
import { resolveStaffPermissions } from '@/lib/rbac/staff-categories'
import { fetchNormalizedStaffCategories, computeCategoryDeniedPermissions, resolvePermissionsFromCategoryAccess } from '@/lib/rbac/role-category-module-access'

/**
 * GET /api/v1/me/permissions?propertyId=...
 *
 * Returns the current user's resolved role, categories, and permissions for a property.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const propertyId = request.nextUrl.searchParams.get('propertyId')?.trim() ?? ''

    if (!propertyId) {
      return error(
        ErrorCodes.VALIDATION_ERROR.code,
        'propertyId query parameter is required',
        ErrorCodes.VALIDATION_ERROR.status,
        request,
      )
    }

    const access = await resolveUserPropertyAccessOrThrow(
      supabase as any,
      propertyId,
      user.id,
      user.user_metadata,
    )

    // Build permission set: role permissions + staff category permissions
    const rolePerms = access.role ? getPermissionsForRole(access.role) : new Set<string>()
    const categoryPerms = access.categories.length > 0
      ? resolveStaffPermissions(access.categories)
      : new Set<string>()
    let allPerms = new Set([...rolePerms, ...categoryPerms])

    const normalizedCategories = await fetchNormalizedStaffCategories(
      supabase as never,
      propertyId,
      user.id,
      access.rawRole,
    )

    const categoryDerivedPerms = normalizedCategories
      ? resolvePermissionsFromCategoryAccess(normalizedCategories.role, normalizedCategories.categories)
      : new Set<import('@/lib/rbac/permissions').PermissionKey>()
    allPerms = new Set([...allPerms, ...categoryDerivedPerms])

    // Subtract explicitly denied permissions from category access control overrides
    if (normalizedCategories) {
      const categoryDeniedPerms = computeCategoryDeniedPermissions(
        normalizedCategories.role,
        normalizedCategories.categories,
      )
      for (const denied of categoryDeniedPerms) {
        allPerms.delete(denied)
      }
    }

    const payload = {
        role: access.role,
        rawRole: access.rawRole,
        categories: access.categories,
        permissions: [...allPerms],
        isOwner: access.isOwner,
        isElevated: access.isElevated,
        isPlatformAdmin: access.isPlatformAdmin,
      }

    return NextResponse.json(
      { success: true, data: payload },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=30',
        },
      },
    )
  } catch (err: unknown) {
    if (err instanceof AccessDeniedError) {
      return error(
        err.statusCode === 404 ? ErrorCodes.AUTH_003 : ErrorCodes.AUTH_002,
        request,
      )
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[me/permissions] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
