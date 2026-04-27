import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceReportQuerySchema } from '@/types/api/v1/schemas/maintenance'
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
            permission: 'maintenance.view_cost_reports',
        })
        if (isDenied(access)) return access

        const { searchParams } = new URL(request.url)
        const queryRaw = {
            from: searchParams.get('from') ?? undefined,
            to: searchParams.get('to') ?? undefined,
        }

        const parsed = MaintenanceReportQuerySchema.safeParse(queryRaw)
        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const report = await queries.getMaintenanceReportSummary(propertyId, {
            ...(parsed.data.from !== undefined ? { from: parsed.data.from } : {}),
            ...(parsed.data.to !== undefined ? { to: parsed.data.to } : {}),
        })

        // Vendor breakdown: SUM of costs grouped by vendor name
        const { data: vendorRows } = await supabase
            .from('maintenance_tasks')
            .select('vendor_id, estimated_labor_cost, estimated_parts_cost')
            .eq('property_id', propertyId)
            .gte('created_at', parsed.data.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .lte('created_at', parsed.data.to ?? new Date().toISOString().split('T')[0])

        const vendorIds = [...new Set((vendorRows ?? []).map((r) => r.vendor_id).filter(Boolean))] as string[]
        const vendorMap: Record<string, string> = {}
        if (vendorIds.length > 0) {
            const { data: vendorNames } = await supabase
                .from('property_vendor')
                .select('id, name')
                .in('id', vendorIds)
            if (vendorNames) {
                for (const v of vendorNames) {
                    vendorMap[v.id] = v.name
                }
            }
        }

        const vendorCostMap: Record<string, number> = {}
        for (const row of vendorRows ?? []) {
            const vid = row.vendor_id ?? 'unassigned'
            vendorCostMap[vid] = (vendorCostMap[vid] ?? 0) + (row.estimated_labor_cost ?? 0) + (row.estimated_parts_cost ?? 0)
        }
        const vendorBreakdown = Object.entries(vendorCostMap).map(([vendorId, totalCost]) => ({
            vendorName: vendorId === 'unassigned' ? 'Unassigned' : (vendorMap[vendorId] ?? 'Unknown'),
            totalCost,
        }))

        // Monthly trend: SUM of costs grouped by YYYY-MM
        const { data: monthlyRows } = await supabase
            .from('maintenance_tasks')
            .select('created_at, estimated_labor_cost, estimated_parts_cost')
            .eq('property_id', propertyId)
            .gte('created_at', parsed.data.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .lte('created_at', parsed.data.to ?? new Date().toISOString().split('T')[0])

        const monthlyMap: Record<string, number> = {}
        for (const row of monthlyRows ?? []) {
            const month = row.created_at?.slice(0, 7) ?? 'unknown'
            monthlyMap[month] = (monthlyMap[month] ?? 0) + (row.estimated_labor_cost ?? 0) + (row.estimated_parts_cost ?? 0)
        }
        const monthlyTrend = Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, totalCost]) => ({ month, totalCost }))

        // Budget comparison
        const { data: budgets } = await supabase
            .from('maintenance_budgets')
            .select('category, period, amount')
            .eq('property_id', propertyId)

        const budgetComparison: Array<{ category: string; period: string; budgetAmount: number; actualSpend: number; remaining: number }> = []
        if (budgets && budgets.length > 0) {
            const dateFrom = parsed.data.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            const dateTo = parsed.data.to ?? new Date().toISOString().split('T')[0]
            const { data: spendRows } = await supabase
                .from('maintenance_tasks')
                .select('category, estimated_labor_cost, estimated_parts_cost')
                .eq('property_id', propertyId)
                .gte('created_at', dateFrom)
                .lte('created_at', dateTo)

            const spendByCategory: Record<string, number> = {}
            for (const row of spendRows ?? []) {
                const cat = row.category ?? 'other'
                spendByCategory[cat] = (spendByCategory[cat] ?? 0) + (row.estimated_labor_cost ?? 0) + (row.estimated_parts_cost ?? 0)
            }

            for (const budget of budgets) {
                const actualSpend = spendByCategory[budget.category] ?? 0
                budgetComparison.push({
                    category: budget.category,
                    period: budget.period,
                    budgetAmount: Number(budget.amount),
                    actualSpend,
                    remaining: Number(budget.amount) - actualSpend,
                })
            }
        }

        return success({ ...report, vendorBreakdown, monthlyTrend, budgetComparison }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance Reports API v1] GET error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}
