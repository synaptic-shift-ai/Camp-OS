import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { type DashboardActivityLog } from "@/lib/dashboard/queries"

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

type AuditingTableProps = {
    propertyId: string
    activityLogs: DashboardActivityLog[] | null
}

export default function AuditingTable({ propertyId, activityLogs }: AuditingTableProps) {
    const rows = activityLogs ?? []
    return (
        <div className="hidden border border-border/80 bg-card/50 md:block">
            <Table className="text-xs">
                <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
                    <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
                        <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                            ID
                        </TableHead>
                        <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                            Action
                        </TableHead>
                        <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                            Resource
                        </TableHead>
                        <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                            User
                        </TableHead>
                        <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                            Date
                        </TableHead>
                        <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                            Details
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((activityLog) => {
                        const formattedDate = formatDate(activityLog.createdAt)
                        return (
                            <TableRow key={activityLog.rowId}>
                                <TableCell className="py-1.5">{activityLog.displayId}</TableCell>
                                <TableCell className="py-1.5">{activityLog.action}</TableCell>
                                <TableCell className="py-1.5">{activityLog.resource}</TableCell>
                                <TableCell className="py-1.5">{activityLog.userDisplayName}</TableCell>
                                <TableCell className="py-1.5">{formattedDate}</TableCell>
                                <TableCell className="py-1.5">{activityLog.details}</TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}