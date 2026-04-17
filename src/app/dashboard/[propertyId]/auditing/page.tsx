import AuditingPageHeader from "@/components/dashboard/auditing/auditing-page-header"
import AuditingFilter from "@/components/dashboard/auditing/auditing-filter"
import AuditingTable from "@/components/dashboard/auditing/auditing-table"
import { createClient } from "@/lib/supabase/server"
import { getPropertyActivityLogs, getPropertyActivityLogResources } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { redirect } from "next/navigation"

type pageProps = {
    params: Promise<{ propertyId: string }>
    searchParams: Promise<{
        page?: string
        pageSize?: string
        q?: string
        action?: string
        resource?: string
        dateFrom?: string
        dateTo?: string
        sortBy?: string
        sortOrder?: string
        [key: string]: string | string[] | undefined
    }>
}

function isValidYmd(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function AuditingPage({ params, searchParams }: pageProps) {
    const { propertyId } = await params

    const property = await getPropertyForUser(propertyId)
    if (!property) redirect("/auth/login")

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect("/auth/login")
    const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
    if (!navVisibility.moduleNavVisible.auditing) {
        redirect(`/dashboard/${propertyId}/access-denied`)
    }

    const sp = await searchParams

    const currentPage = Number.isNaN(Number(sp.page)) || !sp.page ? 1 : Math.max(1, Number(sp.page))
    const parsedPageSize =
        Number.isNaN(Number(sp.pageSize)) || !sp.pageSize ? undefined : Number(sp.pageSize)
    const pageSize = parsedPageSize && parsedPageSize > 0 ? parsedPageSize : 50

    const q = typeof sp.q === "string" ? sp.q : ""
    const action = typeof sp.action === "string" ? sp.action : "all"
    const resource = typeof sp.resource === "string" ? sp.resource : "all"

    const rawFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : ""
    const rawTo = typeof sp.dateTo === "string" ? sp.dateTo : ""
    const dateFrom = isValidYmd(rawFrom) ? rawFrom : ""
    const dateTo = isValidYmd(rawTo) ? rawTo : ""

    type SortByOption = 'displayId' | 'action' | 'resource' | 'userDisplayName' | 'createdAt' | 'details'
    type SortOrderOption = 'asc' | 'desc'
    
    const validSortByOptions: readonly SortByOption[] = ['displayId', 'action', 'resource', 'userDisplayName', 'createdAt', 'details']
    const validSortOrderOptions: readonly SortOrderOption[] = ['asc', 'desc']
    
    const rawSortBy = typeof sp.sortBy === "string" ? sp.sortBy : "createdAt"
    const rawSortOrder = typeof sp.sortOrder === "string" ? sp.sortOrder : "desc"
    
    const sortBy: SortByOption = validSortByOptions.includes(rawSortBy as SortByOption) ? (rawSortBy as SortByOption) : "createdAt"
    const sortOrder: SortOrderOption = validSortOrderOptions.includes(rawSortOrder as SortOrderOption) ? (rawSortOrder as SortOrderOption) : "desc"

    const [{ data: activityLogs, total }, resourceOptions] = await Promise.all([
        getPropertyActivityLogs(
            propertyId,
            currentPage,
            pageSize,
            {
                search: q || null,
                action: action || null,
                resource: resource || null,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                sortBy,
                sortOrder,
            }
        ),
        getPropertyActivityLogResources(propertyId),
    ])

    return (
        <div className="space-y-2">
            <AuditingPageHeader propertyId={propertyId} />
            <AuditingFilter
                propertyId={propertyId}
                defaultSearch={q}
                defaultAction={action}
                defaultResource={resource}
                defaultDateFrom={dateFrom}
                defaultDateTo={dateTo}
                resourceOptions={resourceOptions}
            />
            <AuditingTable
                propertyId={propertyId}
                activityLogs={activityLogs}
                currentPage={currentPage}
                pageSize={pageSize}
                total={total}
                sortBy={sortBy}
                sortOrder={sortOrder}
            />
        </div>
    )
}
