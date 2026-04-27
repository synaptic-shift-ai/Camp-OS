import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'

export async function GET(
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
      permission: 'maintenance.view_assigned',
    })
    if (isDenied(access)) return access

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)

    // Fetch the specific budget by ID
    const budget = await queries.getBudgetById(budgetId, propertyId)
    if (!budget) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Budget not found' })
    }

    const spent = await queries.getCategorySpend(
      propertyId,
      budget.category as string,
      budget.period as 'monthly' | 'quarterly' | 'annual',
    )

    return success({ spent }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Budget Spend Check API] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
