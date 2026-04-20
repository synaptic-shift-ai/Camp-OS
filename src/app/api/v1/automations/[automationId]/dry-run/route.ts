import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { dryRunAutomation } from '@/lib/automations/dry-run'

/**
 * POST /api/v1/automations/[automationId]/dry-run
 *
 * Run a dry-run simulation: replay historical events through the automation's
 * conditions without executing any actions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const body = await request.json()
    const propertyId = body.propertyId as string | undefined
    const dateRange = body.dateRange as '7d' | '30d' | '90d' | { from: string; to: string } | undefined
    const limit = body.limit as number | undefined

    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId is required' })
    }

    if (!dateRange) {
      return error(ErrorCodes.VAL_002, request, { message: 'dateRange is required' })
    }

    // Validate dateRange
    const validPresets = ['7d', '30d', '90d']
    if (typeof dateRange === 'string' && !validPresets.includes(dateRange)) {
      return error(ErrorCodes.VAL_002, request, { message: 'dateRange must be 7d, 30d, 90d, or { from, to }' })
    }
    if (typeof dateRange === 'object') {
      if (!dateRange.from || !dateRange.to) {
        return error(ErrorCodes.VAL_002, request, { message: 'dateRange object must have from and to' })
      }
    }

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      permission: 'automations.manage',
    })
    if (isDenied(access)) return access

    const result = await dryRunAutomation(automationId, propertyId, dateRange, limit)

    return success(result, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
