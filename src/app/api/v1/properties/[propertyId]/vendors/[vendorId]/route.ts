import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; vendorId: string }> },
) {
  try {
    const { propertyId, vendorId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      permission: 'maintenance.manage_vendors',
    })
    if (isDenied(access)) return access

    const body = (await request.json()) as {
      name?: string
      serviceType?: string
      email?: string | null
    }

    const name = body.name?.trim() ?? ''
    const serviceType = body.serviceType?.trim() ?? ''
    const email = body.email?.trim() ? body.email.trim() : null

    if (!name || !serviceType) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        message: 'Vendor name and service type are required.',
      })
    }

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const vendor = await queries.updatePropertyVendor({
      id: vendorId,
      propertyId,
      name,
      serviceType,
      email,
    })

    return success({ vendor }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vendors API v1] PATCH error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; vendorId: string }> },
) {
  try {
    const { propertyId, vendorId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      permission: 'maintenance.manage_vendors',
    })
    if (isDenied(access)) return access

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    await queries.deletePropertyVendor({
      id: vendorId,
      propertyId,
    })

    return success({ deleted: true }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vendors API v1] DELETE error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
