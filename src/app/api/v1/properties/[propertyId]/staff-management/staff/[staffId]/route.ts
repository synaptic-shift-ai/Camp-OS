import { type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'
import { resolveDashboardAccess, canManageStaffRoster } from '@/lib/rbac/dashboard-guards'

const StaffStatusBodySchema = z.object({
  status: z.enum(['inactive', 'active']),
})

const UpdateAccessBodySchema = z
  .object({
    role: z.enum(['admin', 'manager', 'staff']),
    allCategories: z.boolean(),
    roleCategoryIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.allCategories) return
    if (data.roleCategoryIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one category, or set allCategories to true',
        path: ['roleCategoryIds'],
      })
    }
  })

const PatchBodySchema = z.union([StaffStatusBodySchema, UpdateAccessBodySchema])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; staffId: string }> },
) {
  try {
    const { propertyId, staffId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const parsed = PatchBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      const msg =
        parsed.error.errors.map((e) => e.message).join('; ') ||
        ErrorCodes.VALIDATION_ERROR.message
      return error(ErrorCodes.VALIDATION_ERROR.code, msg, ErrorCodes.VALIDATION_ERROR.status, request, {
        errors: parsed.error.errors,
      })
    }

    const access = await resolveDashboardAccess(supabase as never, propertyId, user.id)
    if (!access) {
      return error(
        ErrorCodes.AUTH_002.code,
        'No access to this property. Confirm the property ID and your assignment or company ownership.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    if (!canManageStaffRoster(access)) {
      return error(
        ErrorCodes.AUTH_002.code,
        'Updating staff requires an admin-level property role (owner, admin, or property_admin).',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const q = new StaffManagementQueries(supabase as unknown as SupabaseClient)

    if ('status' in parsed.data) {
      if (parsed.data.status === 'inactive') {
        await q.deactivatePropertyStaffAssignment({ propertyId, staffId })
        return success({ deactivated: true }, request)
      }
      await q.reactivatePropertyStaffAssignment({ propertyId, staffId })
      return success({ reactivated: true }, request)
    }

    await q.updatePropertyStaffAssignment({
      propertyId,
      staffId,
      role: parsed.data.role,
      allCategories: parsed.data.allCategories,
      roleCategoryIds: parsed.data.roleCategoryIds,
    })

    return success({ updated: true }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Staff assignment not found') {
      return error(
        ErrorCodes.RESOURCE_NOT_FOUND.code,
        message,
        ErrorCodes.RESOURCE_NOT_FOUND.status,
        request,
      )
    }
    if (
      message === 'Cannot change property owner from staff management' ||
      message === 'Cannot deactivate property owner from staff management' ||
      message === 'Cannot change property owner status from staff management'
    ) {
      return error(ErrorCodes.AUTH_002.code, message, ErrorCodes.AUTH_002.status, request)
    }
    if (message === 'Staff member is already inactive') {
      return error(
        ErrorCodes.VALIDATION_ERROR.code,
        message,
        ErrorCodes.VALIDATION_ERROR.status,
        request,
      )
    }
    if (message === 'Only inactive staff members can be reactivated') {
      return error(
        ErrorCodes.VALIDATION_ERROR.code,
        message,
        ErrorCodes.VALIDATION_ERROR.status,
        request,
      )
    }
    if (
      message.startsWith('One or more category') ||
      message.startsWith('Select at least one category') ||
      message.startsWith('Each selected category')
    ) {
      return error(
        ErrorCodes.VALIDATION_ERROR.code,
        message,
        ErrorCodes.VALIDATION_ERROR.status,
        request,
      )
    }
    return error(
      ErrorCodes.INTERNAL_ERROR.code,
      message,
      ErrorCodes.INTERNAL_ERROR.status,
      request,
    )
  }
}
