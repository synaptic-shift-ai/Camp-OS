/**
 * Company isolation guard for system automations.
 *
 * System automations have no property_id, so RLS cannot scope them.
 * Instead, we verify that the authenticated user belongs to the same
 * company as the automation's company_id by checking that the user
 * has access to at least one property in that company.
 */

import { error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import type { NextRequest, NextResponse } from 'next/server'

/**
 * Verify that the user has access to the same company as a system automation.
 * Returns a NextResponse (404) if the user has no property access in that company,
 * or null if the check passes.
 */
export async function requireCompanyAccessForSystemAutomation(
  userId: string,
  automationCompanyId: string | null,
  request: NextRequest,
): Promise<NextResponse | null> {
  // If the automation has no company_id, deny access
  if (!automationCompanyId) {
    return error(ErrorCodes.RESOURCE_NOT_FOUND, request)
  }

  // Find any property belonging to this company
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data, error: queryError } = await supabase
    .from('properties' as any)
    .select('id')
    .eq('company_id', automationCompanyId)
    .limit(1)

  if (queryError || !data || data.length === 0) {
    return error(ErrorCodes.RESOURCE_NOT_FOUND, request)
  }

  const propertyId = data[0].id

  // Verify the user actually has access to a property in this company
  const { requirePropertyAccess, isDenied } = await import('@/lib/rbac')
  const access = await requirePropertyAccess(supabase as any, userId, {
    propertyId,
    permission: 'automations.view_dashboard',
  })

  if (isDenied(access)) {
    return error(ErrorCodes.RESOURCE_NOT_FOUND, request)
  }

  return null
}
