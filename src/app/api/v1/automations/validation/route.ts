import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { validateAutomations } from '@/lib/automations/validator'
import type { AutomationRow } from '@/lib/automations/types'

/**
 * POST /api/v1/automations/validation
 *
 * Cross-automation conflict analysis + per-automation checks for a property.
 * Returns issues grouped by severity (error, warning, info).
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const body = await request.json()
    const propertyId = body.propertyId as string | undefined

    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId is required' })
    }

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      permission: 'automations.view',
    })
    if (isDenied(access)) return access

    const { data: automations, error: dbError } = await supabase
      .from('automations' as any)
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order')

    if (dbError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: 'Failed to fetch automations' })
    }

    // Fetch condition groups and actions to check per-automation details
    const automationRows = (automations ?? []) as unknown as AutomationRow[]
    const automationIds = automationRows.map((a) => a.id)

    let conditionGroups: any[] = []
    let actions: any[] = []

    if (automationIds.length > 0) {
      const [groupsRes, actionsRes] = await Promise.all([
        supabase
          .from('automation_condition_groups' as any)
          .select('*')
          .in('automation_id', automationIds),
        supabase
          .from('automation_actions' as any)
          .select('*')
          .in('automation_id', automationIds),
      ])
      conditionGroups = groupsRes.data ?? []
      actions = actionsRes.data ?? []
    }

    const automationDetails = automationRows.map((aut) => ({
      automationId: aut.id,
      hasConditions: conditionGroups.some((g: any) => g.automation_id === aut.id),
      hasActions: actions.some((a: any) => a.automation_id === aut.id),
    }))

    const result = validateAutomations(automationRows, automationDetails)

    return success(result, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
