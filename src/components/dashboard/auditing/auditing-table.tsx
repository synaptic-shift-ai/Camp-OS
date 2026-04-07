"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
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

type SortColumn = 'displayId' | 'action' | 'resource' | 'userDisplayName' | 'createdAt' | 'details'

type AuditingTableProps = {
    propertyId: string
    activityLogs: DashboardActivityLog[] | null
    currentPage: number
    pageSize: number
    total: number
    sortBy: SortColumn
    sortOrder: 'asc' | 'desc'
}

export default function AuditingTable({
    propertyId: _propertyId,
    activityLogs,
    currentPage,
    pageSize,
    total,
    sortBy,
    sortOrder,
}: AuditingTableProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const rows = activityLogs ?? []

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const clampedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
    const startIndex = total === 0 ? 0 : (clampedCurrentPage - 1) * pageSize + 1
    const endIndex = Math.min(total, clampedCurrentPage * pageSize)

    const buildPageHref = (page: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("page", String(page))
        params.set("pageSize", String(pageSize))
        params.set("sortBy", sortBy)
        params.set("sortOrder", sortOrder)
        const q = params.toString()
        return q ? `${pathname}?${q}` : pathname
    }

    const goToPage = (page: number) => {
        startTransition(() => {
            router.push(buildPageHref(page))
        })
    }
    const handlePageSizeChange = (nextPageSize: number) => {
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("page", "1")
            params.set("pageSize", String(nextPageSize))
            params.set("sortBy", sortBy)
            params.set("sortOrder", sortOrder)
            const q = params.toString()
            router.push(q ? `${pathname}?${q}` : pathname)
        })
    }
    const getDefaultSortOrder = (column: SortColumn): 'asc' | 'desc' => {
        if (column === 'displayId' || column === 'createdAt') return 'desc'
        return 'asc'
    }
    const handleSort = (column: SortColumn) => {
        const nextSortOrder =
            sortBy === column
                ? (sortOrder === 'asc' ? 'desc' : 'asc')
                : getDefaultSortOrder(column)

        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("page", "1")
            params.set("pageSize", String(pageSize))
            params.set("sortBy", column)
            params.set("sortOrder", nextSortOrder)
            const q = params.toString()
            router.push(q ? `${pathname}?${q}` : pathname)
        })
    }
    const SortIcon = ({ column }: { column: SortColumn }) => {
        if (sortBy !== column) return <ArrowUpDown className="h-3.5 w-3.5" />
        return sortOrder === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
        ) : (
            <ArrowDown className="h-3.5 w-3.5" />
        )
    }
    return (
        <div className="hidden md:block">
            <div className="border border-border/80 bg-card/50">
                <Table className="text-xs">
                    <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
                        <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-black/70 dark:hover:text-white/70"
                                    onClick={() => handleSort('displayId')}
                                >
                                    ID
                                    <SortIcon column="displayId" />
                                </button>
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-black/70 dark:hover:text-white/70"
                                    onClick={() => handleSort('action')}
                                >
                                    Action
                                    <SortIcon column="action" />
                                </button>
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-black/70 dark:hover:text-white/70"
                                    onClick={() => handleSort('resource')}
                                >
                                    Resource
                                    <SortIcon column="resource" />
                                </button>
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-black/70 dark:hover:text-white/70"
                                    onClick={() => handleSort('userDisplayName')}
                                >
                                    User
                                    <SortIcon column="userDisplayName" />
                                </button>
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-black/70 dark:hover:text-white/70"
                                    onClick={() => handleSort('createdAt')}
                                >
                                    Date
                                    <SortIcon column="createdAt" />
                                </button>
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-black/70 dark:hover:text-white/70"
                                    onClick={() => handleSort('details')}
                                >
                                    Details
                                    <SortIcon column="details" />
                                </button>
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
