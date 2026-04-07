"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
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
    currentPage: number
    pageSize: number
    total: number
}

export default function AuditingTable({
    propertyId,
    activityLogs,
    currentPage,
    pageSize,
    total,
}: AuditingTableProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const rows = activityLogs ?? []

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const clampedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
    const startIndex = total === 0 ? 0 : (clampedCurrentPage - 1) * pageSize + 1
    const endIndex = Math.min(total, clampedCurrentPage * pageSize)

    const buildPageHref = (page: number) => {
        const params = new URLSearchParams()
        params.set("page", String(page))
        params.set("pageSize", String(pageSize))
        return `/dashboard/${propertyId}/auditing?${params.toString()}`
    }

    const goToPage = (page: number) => {
        startTransition(() => {
            router.push(buildPageHref(page))
        })
    }

    const handlePageSizeChange = (nextPageSize: number) => {
        startTransition(() => {
            const params = new URLSearchParams()
            params.set("page", "1")
            params.set("pageSize", String(nextPageSize))
            router.push(`/dashboard/${propertyId}/auditing?${params.toString()}`)
        })
    }

    return (
        <div className="hidden md:block">
            <div className="border border-border/80 bg-card/50">
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
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                    <div>
                        Showing{" "}
                        <span className="font-medium">
                            {startIndex}–{endIndex}
                        </span>{" "}
                        of <span className="font-medium">{total}</span> activities
                    </div>
                    <PageSizeSelector
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        disabled={isPending}
                    />
                </div>
                <div className="flex w-full justify-center sm:w-auto sm:justify-end">
                    <Pagination
                        currentPage={clampedCurrentPage}
                        totalPages={totalPages}
                        onPageChange={goToPage}
                        disabled={isPending}
                        windowSize={2}
                    />
                </div>
            </div>
        </div>
    )
}
