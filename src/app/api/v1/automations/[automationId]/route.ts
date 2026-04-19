import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import {
  getAutomationWithDetails,
  updateAutomationWithDetails,
  deleteAutomation,
} from '@/lib/automations/queries'
import { UpdateAutomationSchema } from '@/lib/automations/schemas'
import type { UpdateAutomationInput as QueryUpdateInput } from '@/lib/automations/queries'

type RouteContext = { params: Promise<{ automationId: string }> }

/**
 * GET /api/v1/automations/[automationId]
 * Get a single automation with full details.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { automationId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const details = await getAutomationWithDetails(automationId)
    if (!details) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request)
    }

    const propertyId = details.automation.property_id
    // System-scope automation — allow any authenticated user
    if (!propertyId) {
      return success(details, request)
    }

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      permission: 'automations.view',
    })
    if (isDenied(access)) return access

    return success(details, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * PUT /api/v1/automations/[automationId]
 * Update an automation.
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { automationId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    // Fetch existing automation to verify access
    const existing = await getAutomationWithDetails(automationId)
    if (!existing) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request)
    }

    const propertyId = existing.automation.property_id
    const isSystem = existing.automation.scope === 'system'

    // System-scope: allow any authenticated user
    if (isSystem) {
      // No additional permission check for system automations
    } else if (propertyId) {
      const access = await requirePropertyAccess(supabase as any, user.id, {
        propertyId,
        permission: 'automations.manage',
      })
      if (isDenied(access)) return access
    }

    const body = await request.json()
    const parsed = UpdateAutomationSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const data = parsed.data

    // Build update input — use spread + explicit property removal to satisfy exactOptionalPropertyTypes
    const updateInput: QueryUpdateInput = {}

    if (data.name !== undefined) updateInput.name = data.name
    if (data.description !== undefined) updateInput.description = data.description
    if (data.isActive !== undefined) updateInput.isActive = data.isActive
    if (data.isTerminal !== undefined) updateInput.isTerminal = data.isTerminal
    if (data.triggerType !== undefined) updateInput.triggerType = data.triggerType
    if (data.triggerConfig !== undefined) updateInput.triggerConfig = data.triggerConfig
    if (data.sortOrder !== undefined) updateInput.sortOrder = data.sortOrder

    if (data.conditionGroups) {
      updateInput.conditionGroups = data.conditionGroups.map((g) => {
        const entry: Record<string, unknown> = {
          logicOperator: g.logicOperator,
          conditions: (g.conditions ?? []).map((c) => ({
            variable: c.variable,
            operator: c.operator,
            value: c.value,
          })),
        }
        if (g.id) entry.id = g.id
        return entry as QueryUpdateInput['conditionGroups'] extends (infer T)[] | undefined ? T : never
      })
    }

    if (data.actions) {
      updateInput.actions = data.actions.map((a) => {
        const mapped: Record<string, unknown> = {
          actionType: a.actionType,
          sortOrder: a.sortOrder ?? 0,
        }
        if (a.id) mapped.id = a.id
        if (a.actionConfig) mapped.actionConfig = a.actionConfig
        if (a.delayValue != null) mapped.delayValue = a.delayValue
        if (a.delayUnit) mapped.delayUnit = a.delayUnit
        return mapped as QueryUpdateInput['actions'] extends (infer T)[] | undefined ? T : never
      })
    }

    await updateAutomationWithDetails(automationId, updateInput)

    const updated = await getAutomationWithDetails(automationId)
    return success(updated, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * DELETE /api/v1/automations/[automationId]
 * Delete an automation. System-scope automations require platform admin.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { automationId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const existing = await getAutomationWithDetails(automationId)
    if (!existing) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request)
    }

    const isSystem = existing.automation.scope === 'system'
    const propertyId = existing.automation.property_id

    // System-scope: allow any authenticated user
    if (isSystem) {
      // No additional permission check
    } else if (propertyId) {
      const access = await requirePropertyAccess(supabase as any, user.id, {
        propertyId,
        permission: 'automations.manage',
      })
      if (isDenied(access)) return access
    }

    await deleteAutomation(automationId)

    return success({ deleted: true }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
