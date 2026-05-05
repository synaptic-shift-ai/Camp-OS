/**
 * Staff API v1 - List and Add Staff
 *
 * Phase 4B: API Consolidation
 *
 * GET /api/v1/properties/[propertyId]/staff - List all staff
 * POST /api/v1/properties/[propertyId]/staff - Add staff member
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { AddStaffRequestSchema } from '@/types/api/v1/schemas/staff'
import {
  ListPropertyStaffQueryHandler,
  AddStaffCommandHandler,
  propertyStaffToDTO,
  SupabasePropertyStaffRepository,
} from '@/modules/StaffManagement'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'

async function verifyPropertyAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string
): Promise<{ hasAccess: boolean; isAdmin: boolean }> {
  const q = new StaffManagementQueries(supabase as SupabaseClient)
  return q.verifyPropertyAccess({ propertyId, userId })
}

/**
 * GET /api/v1/properties/[propertyId]/staff
 *
 * List all staff members for a property.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
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
    const { hasAccess, isAdmin } = await verifyPropertyAccess(supabase, propertyId, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - no access to this property'),
        { status: 403 }
      )
    }
    if (!isAdmin) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - elevated access required to view staff'),
        { status: 403 }
      )
    }

    // 3. Execute query
    const repository = new SupabasePropertyStaffRepository(supabase)
    const handler = new ListPropertyStaffQueryHandler(repository)
    const result = await handler.execute({ propertyId })

    // 4. Return response
    return success({
      staff: result.staff,
      count: result.count,
    })
  } catch (err: unknown) {
    console.error('[Staff API v1] List staff error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to list staff', { message }),
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/properties/[propertyId]/staff
 *
 * Add a new staff member to a property.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
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
    const validated = AddStaffRequestSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 }
      )
    }

    // 4. Execute command
    const repository = new SupabasePropertyStaffRepository(supabase)
    const handler = new AddStaffCommandHandler(repository)

    // Build input - handle optional customPermissions for exactOptionalPropertyTypes
    const result = validated.data.customPermissions !== undefined
      ? await handler.execute({
          propertyId,
          userId: validated.data.userId,
          role: validated.data.role,
          customPermissions: validated.data.customPermissions,
        })
      : await handler.execute({
          propertyId,
          userId: validated.data.userId,
          role: validated.data.role,
        })

    // 5. Handle result
    if (!result.success) {
      const statusCode = result.error.code === 'ALREADY_EXISTS' ? 409 : 400
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.error.message),
        { status: statusCode }
      )
    }

    // 6. Return response
    return NextResponse.json(
      success(propertyStaffToDTO(result.staff)),
      { status: 201 }
    )
  } catch (err: unknown) {
    console.error('[Staff API v1] Add staff error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to add staff', { message }),
      { status: 500 }
    )
  }
}
