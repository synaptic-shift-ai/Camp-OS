"use client"

import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import type { ExecutionLogRow } from "@/lib/automations/queries"

type ActionExecuted = {
    actionId: string
    status: "executed" | "skipped" | "failed"
    error?: string
}

function ActionStatusBadge({ status }: { status: string }) {
    if (status === "executed") {
        return (
            <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Executed
            </Badge>
        )
    }
    if (status === "skipped") {
        return (
            <Badge className="border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                Skipped
            </Badge>
        )
    }
    if (status === "failed") {
        return (
            <Badge className="border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                Failed
            </Badge>
        )
    }
    return (
        <Badge className="border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
            {status}
        </Badge>
    )
}

function getOutcome(log: ExecutionLogRow): "passed" | "skipped" | "failed" | "unknown" {
    const actions = log.actions_executed as Array<{ status: string }> | null
    if (log.skipped_reason === "error" || actions?.some((a) => a.status === "failed")) {
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

function formatTimestamp(dateString: string): string {
    return new Date(dateString).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
}

type ExecutionLogDetailDialogProps = {
    log: ExecutionLogRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ExecutionLogDetailDialog({
    log,
    open,
    onOpenChange,
}: ExecutionLogDetailDialogProps) {
    if (!log) return null

    const outcome = getOutcome(log)
    const actions = (Array.isArray(log.actions_executed) ? log.actions_executed : []) as ActionExecuted[]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Execution Details</DialogTitle>
                    <DialogDescription>
                        {log.automation_name ? `${log.automation_name} — ${log.event_type}` : log.event_type}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 text-sm">
                    {/* Event Info */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm">Event Info</h3>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                            <dt className="text-muted-foreground">Event Type</dt>
                            <dd className="font-mono">{log.event_type}</dd>
                            <dt className="text-muted-foreground">Entity Type</dt>
                            <dd>{log.entity_type ?? "—"}</dd>
                            <dt className="text-muted-foreground">Entity ID</dt>
                            <dd className="font-mono text-xs">{log.entity_id ?? "—"}</dd>
                            <dt className="text-muted-foreground">Timestamp</dt>
                            <dd>{formatTimestamp(log.created_at)}</dd>
                        </dl>
                    </div>

                    {/* Result */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm">Result</h3>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                            <dt className="text-muted-foreground">Outcome</dt>
                            <dd><OutcomeBadge outcome={outcome} /></dd>
                            <dt className="text-muted-foreground">Conditions Passed</dt>
                            <dd>
                                {log.conditions_passed === true
                                    ? "Yes"
                                    : log.conditions_passed === false
                                        ? "No"
                                        : "N/A"}
                            </dd>
                            <dt className="text-muted-foreground">Duration</dt>
                            <dd>
                                {log.execution_duration_ms != null
                                    ? `${log.execution_duration_ms}ms`
                                    : "N/A"}
                            </dd>
                        </dl>
                    </div>

                    {/* Actions */}
                    {actions.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm">Actions</h3>
                            <div className="space-y-2">
                                {actions.map((action, idx) => (
                                    <div
                                        key={action.actionId ?? idx}
                                        className="rounded border border-border/60 bg-muted/30 p-3 space-y-1"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-xs">
                                                {action.actionId ?? `Action ${idx + 1}`}
                                            </span>
                                            <ActionStatusBadge status={action.status} />
                                        </div>
                                        {action.status === "failed" && action.error && (
                                            <p className="text-xs text-red-600 dark:text-red-400">
                                                {action.error}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
