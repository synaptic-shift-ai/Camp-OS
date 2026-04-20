import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { listAutomations, createAutomationWithDetails } from '@/lib/automations/queries'
import { CreateAutomationSchema } from '@/lib/automations/schemas'
import type { AutomationPhase, AutomationScope } from '@/lib/automations/types'

/**
 * GET /api/v1/automations?propertyId=xxx
 * List automations for a property.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const sp = request.nextUrl.searchParams
    const propertyId = sp.get('propertyId')

    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId query parameter is required' })
    }

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      permission: 'automations.view',
    })
    if (isDenied(access)) return access

    const filters: { phase?: AutomationPhase; scope?: AutomationScope; isActive?: boolean } = {}
    const phaseParam = sp.get('phase')
    const scopeParam = sp.get('scope')
    const isActiveParam = sp.get('isActive')

    if (phaseParam) filters.phase = phaseParam as AutomationPhase
    if (scopeParam) filters.scope = scopeParam as AutomationScope
    if (isActiveParam === 'true') filters.isActive = true
    if (isActiveParam === 'false') filters.isActive = false

    const automations = await listAutomations(propertyId, filters)

    return success({ automations }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * POST /api/v1/automations
 * Create a new automation.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const body = await request.json()
    const parsed = CreateAutomationSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const data = parsed.data

    // System-scope automations — allow any authenticated user
    if (data.scope === 'system') {
      // Resolve a company_id for the system automation (DB requires NOT NULL)
      if (!data.companyId) {
        const { data: firstCompany } = await supabase
          .from('companies' as any)
          .select('id')
          .limit(1)
          .single()
        if (!firstCompany) {
          return error(ErrorCodes.VAL_002, request, { message: 'No company found for system automation' })
        }
        data.companyId = firstCompany.id
      }
    } else {
      const propertyId = data.propertyId
      if (!propertyId) {
        return error(ErrorCodes.VAL_002, request, { message: 'propertyId is required for property-scope automations' })
      }
      const access = await requirePropertyAccess(supabase as any, user.id, {
        propertyId,
        permission: 'automations.manage',
      })
      if (isDenied(access)) return access
    }

    const conditionGroups = (data.conditionGroups ?? []).map((g) => ({
      logicOperator: g.logicOperator,
      conditions: (g.conditions ?? []).map((c) => ({
        variable: c.variable,
        operator: c.operator,
        value: c.value,
      })),
    }))

    const actions = (data.actions ?? []).map((a) => {
      const mapped: Record<string, unknown> = {
        actionType: a.actionType,
        sortOrder: a.sortOrder ?? 0,
      }
      if (a.actionConfig) mapped.actionConfig = a.actionConfig
      if (a.delayValue != null) mapped.delayValue = a.delayValue
      if (a.delayUnit) mapped.delayUnit = a.delayUnit
      return mapped as Parameters<typeof createAutomationWithDetails>[0]['actions'] extends (infer T)[] ? T : never
    })

    const input: Record<string, unknown> = {
      companyId: data.companyId,
      propertyId: data.propertyId ?? null,
      name: data.name,
      phase: data.phase as Parameters<typeof createAutomationWithDetails>[0]['phase'],
      scope: data.scope,
      isActive: data.isActive,
      isTerminal: data.isTerminal,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig,
      sortOrder: data.sortOrder,
      conditionGroups,
      actions,
    }
    if (data.description) input.description = data.description

    const result = await createAutomationWithDetails(input as unknown as Parameters<typeof createAutomationWithDetails>[0])

    return success(result, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
