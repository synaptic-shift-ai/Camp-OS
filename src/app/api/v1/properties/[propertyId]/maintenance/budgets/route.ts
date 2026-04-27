import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'
import { CreateBudgetRequestSchema } from '@/types/api/v1/schemas/maintenance'

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
    const budgets = await queries.listBudgets(propertyId)

    return success({ budgets }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Budgets API v1] GET error:', err)
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
      permission: 'maintenance.manage_budgets',
    })
    if (isDenied(access)) return access

    const body = await request.json()
    const parsed = CreateBudgetRequestSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ')
      return error(ErrorCodes.VALIDATION_ERROR, request, { message })
    }

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const budget = await queries.createBudget({
      propertyId,
      category: parsed.data.category,
      period: parsed.data.period,
      amount: parsed.data.amount,
      createdBy: user.id,
    })

    return success({ budget }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Budgets API v1] POST error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
