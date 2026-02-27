/**
 * Staff API v1 - Get, Update, Delete Staff Member
 *
 * Phase 4B: API Consolidation
 *
 * GET /api/v1/properties/[propertyId]/staff/[staffId] - Get staff member
 * PATCH /api/v1/properties/[propertyId]/staff/[staffId] - Update staff role/permissions
 * DELETE /api/v1/properties/[propertyId]/staff/[staffId] - Remove staff member
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { UpdateStaffRequestSchema } from '@/types/api/v1/schemas/staff'
import {
  GetPropertyStaffQueryHandler,
  UpdateStaffRoleCommandHandler,
  UpdateStaffPermissionsCommandHandler,
  RemoveStaffCommandHandler,
  propertyStaffToDTO,
  SupabasePropertyStaffRepository,
} from '@/modules/StaffManagement'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus'

/**
 * Verify user has access to property (BP-4: Tenant isolation)
 */
async function verifyPropertyAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string
): Promise<{ hasAccess: boolean; isAdmin: boolean }> {
  // Check if user owns the property via company
  const { data: property } = await supabase
    .from('properties')
    .select('company_id')
    .eq('id', propertyId)
    .single()

  if (!property) {
    return { hasAccess: false, isAdmin: false }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('owner_id')
    .eq('id', property.company_id)
    .single()

  if (company?.owner_id === userId) {
    return { hasAccess: true, isAdmin: true }
  }

  // Check if user is staff at this property
  const { data: staffRecord } = await supabase
    .from('property_staff')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .single()

  if (staffRecord) {
    const isAdmin = staffRecord.role === 'owner' || staffRecord.role === 'manager'
    return { hasAccess: true, isAdmin }
  }

  return { hasAccess: false, isAdmin: false }
}

/**
 * GET /api/v1/properties/[propertyId]/staff/[staffId]
 *
 * Get a specific staff member.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; staffId: string }> }
) {
  try {
    const { propertyId, staffId } = await params
    const supabase = await createClient()

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // 2. Verify property access (BP-4: Tenant isolation)
    const { hasAccess } = await verifyPropertyAccess(supabase, propertyId, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - no access to this property'),
        { status: 403 }
      )
    }

    // 3. Execute query
    const repository = new SupabasePropertyStaffRepository(supabase)
    const handler = new GetPropertyStaffQueryHandler(repository)
    const result = await handler.execute({ staffId })

    if (!result.success) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, result.error.message),
        { status: 404 }
      )
    }

    // 4. Verify staff belongs to this property
    if (result.staff.propertyId !== propertyId) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Staff member not found at this property'),
        { status: 404 }
      )
    }

    // 5. Return response
    return success(result.staff)
  } catch (err: unknown) {
    console.error('[Staff API v1] Get staff error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get staff', { message }),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/properties/[propertyId]/staff/[staffId]
 *
 * Update a staff member's role or permissions.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; staffId: string }> }
) {
  try {
    const { propertyId, staffId } = await params
    const supabase = await createClient()

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // 2. Verify admin access (BP-4: Tenant isolation + permission check)
    const { hasAccess, isAdmin } = await verifyPropertyAccess(supabase, propertyId, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - no access to this property'),
        { status: 403 }
      )
    }
    if (!isAdmin) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - admin access required to manage staff'),
        { status: 403 }
      )
    }

    // 3. Parse and validate request body
    const body = await request.json()
    const validated = UpdateStaffRequestSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 }
      )
    }

    // 4. Verify staff exists and belongs to this property
    const repository = new SupabasePropertyStaffRepository(supabase)
    const getHandler = new GetPropertyStaffQueryHandler(repository)
    const getResult = await getHandler.execute({ staffId })

    if (!getResult.success) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, getResult.error.message),
        { status: 404 }
      )
    }

    if (getResult.staff.propertyId !== propertyId) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Staff member not found at this property'),
        { status: 404 }
      )
    }

    const eventBus = new InMemoryEventBus()
    let updatedStaff = getResult.staff

    // 5. Update role if provided
    if (validated.data.role !== undefined) {
      const roleHandler = new UpdateStaffRoleCommandHandler(repository, eventBus)

      // Build input with explicit handling of optional resetPermissions
      const roleInput: {
        staffId: string
        newRole: 'manager' | 'staff' | 'viewer'
        changedBy: string
        resetPermissions?: boolean
      } = {
        staffId,
        newRole: validated.data.role,
        changedBy: user.id,
      }
      if (validated.data.resetPermissions !== undefined) {
        roleInput.resetPermissions = validated.data.resetPermissions
      }

      const roleResult = await roleHandler.execute(roleInput)

      if (!roleResult.success) {
        const statusCode =
          roleResult.error.code === 'NOT_FOUND' ? 404 :
          roleResult.error.code === 'CANNOT_CHANGE_OWNER_ROLE' ? 403 :
          400
        return NextResponse.json(
          error(ErrorCodes.VALIDATION_ERROR, roleResult.error.message),
          { status: statusCode }
        )
      }

      updatedStaff = propertyStaffToDTO(roleResult.staff)
    }

    // 6. Update permissions if provided (and no role change, or role change with custom perms)
    if (validated.data.customPermissions !== undefined && validated.data.role === undefined) {
      const permHandler = new UpdateStaffPermissionsCommandHandler(repository, eventBus)
      const permResult = await permHandler.execute({
        staffId,
        permissions: validated.data.customPermissions,
        updatedBy: user.id,
      })

      if (!permResult.success) {
        return NextResponse.json(
          error(ErrorCodes.VALIDATION_ERROR, permResult.error.message),
          { status: 400 }
        )
      }

      updatedStaff = propertyStaffToDTO(permResult.staff)
    }

    // 7. Return response
    return success(updatedStaff)
  } catch (err: unknown) {
    console.error('[Staff API v1] Update staff error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to update staff', { message }),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/properties/[propertyId]/staff/[staffId]
 *
 * Remove a staff member from the property.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; staffId: string }> }
) {
  try {
    const { propertyId, staffId } = await params
    const supabase = await createClient()

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // 2. Verify admin access (BP-4: Tenant isolation + permission check)
    const { hasAccess, isAdmin } = await verifyPropertyAccess(supabase, propertyId, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - no access to this property'),
        { status: 403 }
      )
    }
    if (!isAdmin) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - admin access required to manage staff'),
        { status: 403 }
      )
    }

    // 3. Verify staff exists and belongs to this property
    const repository = new SupabasePropertyStaffRepository(supabase)
    const getHandler = new GetPropertyStaffQueryHandler(repository)
    const getResult = await getHandler.execute({ staffId })

    if (!getResult.success) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, getResult.error.message),
        { status: 404 }
      )
    }

    if (getResult.staff.propertyId !== propertyId) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Staff member not found at this property'),
        { status: 404 }
      )
    }

    // 4. Execute command
    const eventBus = new InMemoryEventBus()
    const handler = new RemoveStaffCommandHandler(repository, eventBus)

    const result = await handler.execute({
      staffId,
      removedBy: user.id,
    })

    // 5. Handle result
    if (!result.success) {
      const statusCode = result.error.code === 'CANNOT_REMOVE_OWNER' ? 403 : 404
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.error.message),
        { status: statusCode }
      )
    }

    // 6. Return 204 No Content
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    console.error('[Staff API v1] Remove staff error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to remove staff', { message }),
      { status: 500 }
    )
  }
}
