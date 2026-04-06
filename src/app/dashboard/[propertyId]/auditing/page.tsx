import AuditingPageHeader from "@/components/dashboard/auditing/auditing-page-header"
import AuditingFilter from "@/components/dashboard/auditing/auditing-filter"
import AuditingTable from "@/components/dashboard/auditing/auditing-table"
import { getPropertyActivityLogs } from "@/lib/dashboard/queries"

type pageProps = {
    params: Promise<{ propertyId: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AuditingPage({ params }: pageProps) {
    const { propertyId } = await params
    const activityLogs = await getPropertyActivityLogs(propertyId)
    return (
        <div className="space-y-2">
            <AuditingPageHeader propertyId={propertyId} />
            <AuditingFilter propertyId={propertyId} />
            <AuditingTable propertyId={propertyId} activityLogs={activityLogs} />
        </div>
    )
}