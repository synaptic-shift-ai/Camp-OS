import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'
import { UpdateBudgetRequestSchema } from '@/types/api/v1/schemas/maintenance'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; budgetId: string }> },
) {
  try {
    const { propertyId, budgetId } = await params
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
      permission: 'maintenance.manage_budgets',
    })
    if (isDenied(access)) return access

    const body = await request.json()
    const parsed = UpdateBudgetRequestSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ')
      return error(ErrorCodes.VALIDATION_ERROR, request, { message })
    }

    const updates: { category?: string; period?: 'monthly' | 'quarterly' | 'annual'; amount?: number } = {}
    if (parsed.data.category !== undefined) updates.category = parsed.data.category
    if (parsed.data.period !== undefined) updates.period = parsed.data.period
    if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const budget = await queries.updateBudget(budgetId, propertyId, updates)

    return success({ budget }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Budgets API v1] PATCH error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; budgetId: string }> },
) {
  try {
    const { propertyId, budgetId } = await params
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
      permission: 'maintenance.manage_budgets',
    })
    if (isDenied(access)) return access

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    await queries.deleteBudget(budgetId, propertyId)

    return success({ deleted: true }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Budgets API v1] DELETE error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
