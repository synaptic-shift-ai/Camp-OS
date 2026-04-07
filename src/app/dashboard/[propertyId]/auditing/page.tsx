import AuditingPageHeader from "@/components/dashboard/auditing/auditing-page-header"
import AuditingFilter from "@/components/dashboard/auditing/auditing-filter"
import AuditingTable from "@/components/dashboard/auditing/auditing-table"
import { getPropertyActivityLogs } from "@/lib/dashboard/queries"

type pageProps = {
    params: Promise<{ propertyId: string }>
    searchParams: Promise<{ page?: string; pageSize?: string; [key: string]: string | string[] | undefined }>
}

export default async function AuditingPage({ params, searchParams }: pageProps) {
    const { propertyId } = await params
    const { page: pageParam, pageSize: pageSizeParam } = await searchParams

    const currentPage = Number.isNaN(Number(pageParam)) || !pageParam ? 1 : Math.max(1, Number(pageParam))
    const parsedPageSize =
        Number.isNaN(Number(pageSizeParam)) || !pageSizeParam ? undefined : Number(pageSizeParam)
    const pageSize = parsedPageSize && parsedPageSize > 0 ? parsedPageSize : 10

    const { data: activityLogs, total } = await getPropertyActivityLogs(propertyId, currentPage, pageSize)

    return (
        <div className="space-y-2">
            <AuditingPageHeader propertyId={propertyId} />
            <AuditingFilter propertyId={propertyId} />
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