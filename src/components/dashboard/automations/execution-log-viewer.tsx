"use client"

import { useState } from "react"
import type { ExecutionLogRow } from "@/lib/automations/queries"
import { ExecutionLogFilter } from "./execution-log-filter"
import { ExecutionLogTable } from "./execution-log-table"
import { ExecutionLogDetailDialog } from "./execution-log-detail-dialog"

type ExecutionLogViewerProps = {
    logs: ExecutionLogRow[]
    automations: Array<{ id: string; name: string }>
    total: number
    currentPage: number
    pageSize: number
    sortBy: string
    sortOrder: string
    filters: {
        automationId?: string
        outcome?: string
        dateFrom?: string
        dateTo?: string
        search?: string
    }
}

export function ExecutionLogViewer({
    logs,
    automations,
    total,
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
    filters,
}: ExecutionLogViewerProps) {
    const [selectedLog, setSelectedLog] = useState<ExecutionLogRow | null>(null)

    return (
        <div className="space-y-4">
            <ExecutionLogFilter
                automations={automations}
                currentParams={filters}
                onFilterChange={() => {}}
            />
            <ExecutionLogTable
                logs={logs}
                currentPage={currentPage}
                pageSize={pageSize}
                total={total}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onRowClick={setSelectedLog}
            />
            <ExecutionLogDetailDialog
                log={selectedLog}
                open={selectedLog !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedLog(null)
                }}
            />
        </div>
    )
}
