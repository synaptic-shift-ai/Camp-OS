"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { Badge } from "@/components/ui/badge"
import type { ExecutionLogRow, ExecutionLogSortColumn, ExecutionLogSortOrder } from "@/lib/automations/queries"

type SortColumn = ExecutionLogSortColumn
type SortOrder = ExecutionLogSortOrder

type ExecutionLogTableProps = {
    logs: ExecutionLogRow[]
    currentPage: number
    pageSize: number
    total: number
    sortBy: string
    sortOrder: string
    onRowClick: (log: ExecutionLogRow) => void
}

function formatRelativeTime(dateString: string): string {
    const now = Date.now()
    const then = new Date(dateString).getTime()
    const diffMs = now - then
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffSec < 60) return "just now"
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 30) return `${diffDay}d ago`
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatAbsoluteTime(dateString: string): string {
    return new Date(dateString).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
}

type ActionStatus = { status: string }

function parseActionCounts(actionsExecuted: unknown): { executed: number; skipped: number; failed: number } {
    const actions = actionsExecuted as ActionStatus[] | null
    if (!actions || !Array.isArray(actions)) {
        return { executed: 0, skipped: 0, failed: 0 }
    }
    const executed = actions.filter(a => a.status === "executed").length
    const skipped = actions.filter(a => a.status === "skipped").length
    const failed = actions.filter(a => a.status === "failed").length
    return { executed, skipped, failed }
}

function getOutcome(log: ExecutionLogRow): "passed" | "skipped" | "failed" | "unknown" {
    const { failed } = parseActionCounts(log.actions_executed)
    if (log.skipped_reason === "error" || failed > 0) {
        return "failed"
    }
    if (log.conditions_passed === true) return "passed"
    if (log.conditions_passed === false) return "skipped"
    return "unknown"
}

function OutcomeBadge({ outcome }: { outcome: string }) {
    if (outcome === "passed") {
        return (
            <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Passed
            </Badge>
        )
    }
    if (outcome === "skipped") {
        return (
            <Badge className="border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                Skipped
            </Badge>
        )
    }
    if (outcome === "failed") {
        return (
            <Badge className="border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                Failed
            </Badge>
        )
    }
    return (
        <Badge className="border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
            Unknown
        </Badge>
    )
}

function CountBadge({ count, variant }: { count: number; variant: "success" | "warning" | "danger" }) {
    if (count === 0) return <span className="text-muted-foreground">0</span>
    
    const colorClasses = {
        success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
        danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    }
    
    return (
        <span className={`inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded text-xs font-medium ${colorClasses[variant]}`}>
            {count}
        </span>
    )
}

export function ExecutionLogTable({
    logs,
    currentPage,
    pageSize,
    total,
    sortBy,
    sortOrder,
    onRowClick,
}: ExecutionLogTableProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

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

    const getDefaultSortOrder = (column: SortColumn): SortOrder => {
        if (column === "created_at") return "desc"
        return "asc"
    }

    const handleSort = (column: SortColumn) => {
        const nextSortOrder =
            sortBy === column
                ? (sortOrder === "asc" ? "desc" : "asc")
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
        return sortOrder === "asc" ? (
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
                                    onClick={() => handleSort("created_at")}
                                >
                                    Timestamp
                                    <SortIcon column="created_at" />
                                </button>
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                Automation
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                Entity
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium text-center">
                                Condition
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium text-center">
                                Executed
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium text-center">
                                Skipped
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium text-center">
                                Failed
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-black/70 dark:hover:text-white/70"
                                    onClick={() => handleSort("execution_duration_ms")}
                                >
                                    Duration
                                    <SortIcon column="execution_duration_ms" />
                                </button>
                            </TableHead>
                            <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                                Outcome
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.map((log) => {
                            const outcome = getOutcome(log)
                            const { executed, skipped, failed } = parseActionCounts(log.actions_executed)
                            return (
                                <TableRow
                                    key={log.id}
                                    className="cursor-pointer"
                                    onClick={() => onRowClick(log)}
                                >
                                    <TableCell className="py-1.5" title={formatAbsoluteTime(log.created_at)}>
                                        {formatRelativeTime(log.created_at)}
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                        {log.automation_name ?? "—"}
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                        {log.entity_type
                                            ? `${log.entity_type}/${log.entity_id?.slice(0, 8) ?? "—"}`
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="py-1.5 text-center">
                                        {log.conditions_passed === true ? (
                                            <span className="text-green-600">✓</span>
                                        ) : log.conditions_passed === false ? (
                                            <span className="text-red-600">✗</span>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-1.5 text-center">
                                        <CountBadge count={executed} variant="success" />
                                    </TableCell>
                                    <TableCell className="py-1.5 text-center">
                                        <CountBadge count={skipped} variant="warning" />
                                    </TableCell>
                                    <TableCell className="py-1.5 text-center">
                                        <CountBadge count={failed} variant="danger" />
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                        {log.execution_duration_ms != null
                                            ? `${log.execution_duration_ms}ms`
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                        <OutcomeBadge outcome={outcome} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {logs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                                    No execution logs found.
                                </TableCell>
                            </TableRow>
                        )}
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
                        of <span className="font-medium">{total}</span> results
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
