import AuditingPageHeader from "@/components/dashboard/auditing/auditing-page-header"
import AuditingFilter from "@/components/dashboard/auditing/auditing-filter"
import AuditingTable from "@/components/dashboard/auditing/auditing-table"
import { getPropertyActivityLogs } from "@/lib/dashboard/queries"

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
        [key: string]: string | string[] | undefined
    }>
}

function isValidYmd(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function AuditingPage({ params, searchParams }: pageProps) {
    const { propertyId } = await params
    const sp = await searchParams

    const currentPage = Number.isNaN(Number(sp.page)) || !sp.page ? 1 : Math.max(1, Number(sp.page))
    const parsedPageSize =
        Number.isNaN(Number(sp.pageSize)) || !sp.pageSize ? undefined : Number(sp.pageSize)
    const pageSize = parsedPageSize && parsedPageSize > 0 ? parsedPageSize : 10

    const q = typeof sp.q === "string" ? sp.q : ""
    const action = typeof sp.action === "string" ? sp.action : "all"
    const resource = typeof sp.resource === "string" ? sp.resource : "all"

    const rawFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : ""
    const rawTo = typeof sp.dateTo === "string" ? sp.dateTo : ""
    const dateFrom = isValidYmd(rawFrom) ? rawFrom : ""
    const dateTo = isValidYmd(rawTo) ? rawTo : ""

    const { data: activityLogs, total } = await getPropertyActivityLogs(
        propertyId,
        currentPage,
        pageSize,
        {
            search: q || null,
            action: action || null,
            resource: resource || null,
            dateFrom: dateFrom || null,
            dateTo: dateTo || null,
        }
    )

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
            />
            <AuditingTable
                propertyId={propertyId}
                activityLogs={activityLogs}
                currentPage={currentPage}
                pageSize={pageSize}
                total={total}
            />
        </div>
    )
}
