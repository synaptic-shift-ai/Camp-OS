import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { listAutomations, listSystemAutomations, listExecutionLogs, type ExecutionLogSortColumn, type ExecutionLogSortOrder } from '@/lib/automations/queries'
import { PHASE_ORDER } from '@/lib/automations/types'
import { AutomationsPageClient } from './automations-page-client'
import { createClient } from '@/lib/supabase/server'

function isValidYmd(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

const VALID_SORT_COLUMNS: readonly ExecutionLogSortColumn[] = ['created_at', 'execution_duration_ms', 'event_type']
const VALID_SORT_ORDERS: readonly ExecutionLogSortOrder[] = ['asc', 'desc']

export default async function AutomationsPage({
    params,
    searchParams,
}: {
    params: Promise<{ propertyId: string }>
    searchParams: Promise<{
        tab?: string
        page?: string
        pageSize?: string
        automationId?: string
        outcome?: string
        dateFrom?: string
        dateTo?: string
        search?: string
        sortBy?: string
        sortOrder?: string
        [key: string]: string | string[] | undefined
    }>
}) {
    const { propertyId } = await params
    const property = await getPropertyForUser(propertyId)
    if (!property) redirect('/auth/login')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
    if (!navVisibility.moduleNavVisible['automations']) redirect(`/dashboard/${propertyId}/access-denied`)

    const sp = await searchParams
    const tab = typeof sp.tab === "string" ? sp.tab : "dashboard"

    // ── Automations (builder) tab ────────────────────────────────────────
    if (tab === "automations") {
        const automations = await listAutomations(propertyId, undefined, property.company_id)
        return (
            <AutomationsPageClient
                propertyName={property.name}
                totalAutomations={automations.length}
                activeCount={automations.filter(a => a.is_active).length}
                inactiveCount={automations.length - automations.filter(a => a.is_active).length}
                phaseDistribution={PHASE_ORDER.map(phase => ({ phase, count: automations.filter(a => a.phase === phase).length }))}
                executionSummary={{ passed: 0, failed: 0, skipped: 0, total: 0 }}
                recentLogs={[]}
                activeTab="automations"
                propertyId={propertyId}
                companyId={property.company_id ?? ''}
                automationsList={automations}
            />
        )
    }

    // ── System Automations tab ────────────────────────────────────────
    if (tab === "system-automations") {
        const systemAutomations = await listSystemAutomations(property.company_id ?? '').catch(() => [])
        return (
            <AutomationsPageClient
                propertyName={property.name}
                totalAutomations={0}
                activeCount={0}
                inactiveCount={0}
                phaseDistribution={[]}
                executionSummary={{ passed: 0, failed: 0, skipped: 0, total: 0 }}
                recentLogs={[]}
                activeTab="system-automations"
                propertyId={propertyId}
                companyId={property.company_id ?? ''}
                systemAutomationsList={systemAutomations}
            />
        )
    }

    // ── Validation tab ───────────────────────────────────────────────
    if (tab === "validation") {
        return (
            <AutomationsPageClient
                propertyName={property.name}
                totalAutomations={0}
                activeCount={0}
                inactiveCount={0}
                phaseDistribution={[]}
                executionSummary={{ passed: 0, failed: 0, skipped: 0, total: 0 }}
                recentLogs={[]}
                activeTab="validation"
                propertyId={propertyId}
                companyId={property.company_id ?? ''}
            />
        )
    }

    // ── Email Templates tab ────────────────────────────────────────────
    if (tab === "email-templates") {
        const companyId = property.company_id
        let emailTemplates: Array<Record<string, unknown>> = []
        if (companyId) {
            const supabase = await createClient()
            const { data } = await supabase
                .from('email_templates')
                .select('*')
                .eq('company_id', companyId)
                .or(`property_id.is.null,property_id.eq.${propertyId}`)
                .order('is_system_default', { ascending: false })
                .order('name', { ascending: true })
            emailTemplates = (data ?? []) as Array<Record<string, unknown>>
        }
        return (
            <AutomationsPageClient
                propertyName={property.name}
                totalAutomations={0}
                activeCount={0}
                inactiveCount={0}
                phaseDistribution={[]}
                executionSummary={{ passed: 0, failed: 0, skipped: 0, total: 0 }}
                recentLogs={[]}
                activeTab="email-templates"
                propertyId={propertyId}
                companyId={companyId ?? ''}
                emailTemplates={emailTemplates}
            />
        )
    }

    // ── Execution Logs tab ────────────────────────────────────────────────
    if (tab === "execution-log") {
        const currentPage = Number.isNaN(Number(sp.page)) || !sp.page ? 1 : Math.max(1, Number(sp.page))
        const parsedPageSize = Number.isNaN(Number(sp.pageSize)) || !sp.pageSize ? undefined : Number(sp.pageSize)
        const pageSize = parsedPageSize && parsedPageSize > 0 ? parsedPageSize : 10

        const automationId = typeof sp.automationId === "string" ? sp.automationId : ""
        const outcome = typeof sp.outcome === "string" ? sp.outcome : ""
        const search = typeof sp.search === "string" ? sp.search : ""

        const rawFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : ""
        const rawTo = typeof sp.dateTo === "string" ? sp.dateTo : ""
        const dateFrom = isValidYmd(rawFrom) ? rawFrom : ""
        const dateTo = isValidYmd(rawTo) ? rawTo : ""

        const rawSortBy = typeof sp.sortBy === "string" ? sp.sortBy : "created_at"
        const rawSortOrder = typeof sp.sortOrder === "string" ? sp.sortOrder : "desc"
        const sortBy: ExecutionLogSortColumn = VALID_SORT_COLUMNS.includes(rawSortBy as ExecutionLogSortColumn) ? (rawSortBy as ExecutionLogSortColumn) : "created_at"
        const sortOrder: ExecutionLogSortOrder = VALID_SORT_ORDERS.includes(rawSortOrder as ExecutionLogSortOrder) ? (rawSortOrder as ExecutionLogSortOrder) : "desc"

        const logFilters: Parameters<typeof listExecutionLogs>[1] = {
            sortBy,
            sortOrder,
            limit: pageSize,
            offset: (currentPage - 1) * pageSize,
        }
        if (automationId) logFilters.automationId = automationId
        if (outcome === "passed" || outcome === "skipped" || outcome === "failed") logFilters.outcome = outcome
        if (dateFrom) logFilters.dateFrom = dateFrom
        if (dateTo) logFilters.dateTo = dateTo
        if (search) logFilters.search = search

        // Fetch automations first so we can match search term against names
        const automations = await listAutomations(propertyId, undefined, property.company_id)
        if (search) {
            const matchingIds = automations
                .filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
                .map(a => a.id)
            if (matchingIds.length) logFilters.automationIds = matchingIds
        }

        if (property.company_id) logFilters.companyId = property.company_id

        const logsResult = await listExecutionLogs(propertyId, logFilters)

        return (
            <AutomationsPageClient
                propertyName={property.name}
                totalAutomations={0}
                activeCount={0}
                inactiveCount={0}
                phaseDistribution={[]}
                executionSummary={{ passed: 0, failed: 0, skipped: 0, total: 0 }}
                recentLogs={[]}
                executionLogData={{
                    logs: logsResult.logs,
                    automations: automations.map((a) => ({ id: a.id, name: a.name })),
                    total: logsResult.total,
                    currentPage,
                    pageSize,
                    sortBy,
                    sortOrder,
                    filters: {
                        ...(automationId ? { automationId } : {}),
                        ...(outcome ? { outcome } : {}),
                        ...(dateFrom ? { dateFrom } : {}),
                        ...(dateTo ? { dateTo } : {}),
                        ...(search ? { search } : {}),
                    },
                }}
                activeTab="execution-log"
            />
        )
    }

    // ── Dashboard tab ─────────────────────────────────────────────────────
    const [automations, logsResult] = await Promise.all([
        listAutomations(propertyId, undefined, property.company_id),
        listExecutionLogs(propertyId, {
            dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            limit: 100,
            ...(property.company_id ? { companyId: property.company_id } : {}),
        }),
    ])

    const totalAutomations = automations.length
    const activeCount = automations.filter(a => a.is_active).length
    const inactiveCount = totalAutomations - activeCount

    const phaseDistribution = PHASE_ORDER.map(phase => ({
        phase,
        count: automations.filter(a => a.phase === phase).length,
    }))

    const recentLogs = logsResult.logs
    const executionSummary = {
        passed: recentLogs.filter(l => l.conditions_passed === true).length,
        failed: recentLogs.filter(l => l.skipped_reason === 'error' || (l.actions_executed as Array<{ status: string }> | null)?.some((a: { status: string }) => a.status === 'failed')).length,
        skipped: recentLogs.filter(l => l.conditions_passed === false).length,
        total: recentLogs.length,
    }

    return (
        <AutomationsPageClient
            propertyName={property.name}
            totalAutomations={totalAutomations}
            activeCount={activeCount}
            inactiveCount={inactiveCount}
            phaseDistribution={phaseDistribution}
            executionSummary={executionSummary}
            recentLogs={recentLogs}
            activeTab="dashboard"
        />
    )
}
