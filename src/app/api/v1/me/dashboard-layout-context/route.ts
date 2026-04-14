import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  isStaffAssignmentInactiveForProperty,
  resolveDashboardNavVisibility,
  resolveDashboardUserLabels,
} from '@/lib/dashboard/dashboard-layout-context'

/**
 * GET /api/v1/me/dashboard-layout-context?propertyId=optional
 *
 * Sidebar user labels and nav visibility for the dashboard layout (no DB access from the client).
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001), { status: 401 })
    }

    const propertyId = request.nextUrl.searchParams.get('propertyId')?.trim() ?? ''
    const labels = await resolveDashboardUserLabels(supabase, user, propertyId)

    let staffManagementNavVisible = true
    let propertySettingsNavVisible = true
    let operationsModulesNavVisible = true
    let financialNavVisible = true
    let housekeepingNavVisible = false
    let maintenanceNavVisible = false

    let staffDeactivatedForProperty = false

    if (propertyId.length > 0) {
      staffDeactivatedForProperty = await isStaffAssignmentInactiveForProperty(
        supabase,
        propertyId,
        user.id,
      )

      const nav = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
      staffManagementNavVisible = nav.staffManagementNavVisible
      propertySettingsNavVisible = nav.propertySettingsNavVisible
      operationsModulesNavVisible = nav.operationsModulesNavVisible
      financialNavVisible = nav.financialNavVisible
      housekeepingNavVisible = nav.housekeepingNavVisible
      maintenanceNavVisible = nav.maintenanceNavVisible
    }

    return success({
      ...labels,
      staffDeactivatedForProperty,
      staffManagementNavVisible,
      propertySettingsNavVisible,
      operationsModulesNavVisible,
      financialNavVisible,
      housekeepingNavVisible,
      maintenanceNavVisible,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[dashboard-layout-context] GET error:', err)
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to load dashboard layout context', { message }),
      { status: 500 },
    )
  }
}
