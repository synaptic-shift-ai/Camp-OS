import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'

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

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      permission: 'maintenance.view_assigned',
    })
    if (isDenied(access)) return access

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const rows = await queries.listPropertyVendors(propertyId)

    const vendorOptions = rows.map((row) => ({
      id: row.id,
      label: `${row.name} (${row.service_type})`,
    }))

    const vendors = rows.map((row, index) => ({
      id: row.id,
      displayId: `VEN-${String(index + 1).padStart(3, '0')}`,
      name: row.name,
      service: row.service_type,
      contact: row.email ?? '—',
      linkedWorkOrders: null,
    }))

    return success({ vendorOptions, vendors }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vendors API v1] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

export async function POST(
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
    const vendor = await queries.createPropertyVendor({
      propertyId,
      name,
      serviceType,
      email,
    })

    const vendorOption = {
      id: vendor.id,
      label: `${vendor.name} (${vendor.service_type})`,
    }

    return success({ vendor, vendorOption }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vendors API v1] POST error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
