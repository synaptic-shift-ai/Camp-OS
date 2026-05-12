"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Mail,
  MessageSquare,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Pagination } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

type CommunicationLog = {
  id: string
  channel: string
  status: string
  subject: string | null
  recipient_address: string | null
  bounce_type: string | null
  failure_reason: string | null
  opened_at: string | null
  clicked_at: string | null
  created_at: string
  template: { name: string } | null
}

type StatusOption = "all" | "delivered" | "opened" | "sent" | "bounced" | "failed" | "skipped" | "queued"

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "delivered", label: "Delivered" },
  { value: "opened", label: "Opened" },
  { value: "sent", label: "Sent" },
  { value: "bounced", label: "Bounced" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
  { value: "queued", label: "Queued" },
]

const CHANNEL_OPTIONS = ["all", "EMAIL", "SMS"] as const

const PAGE_SIZE = 20

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase() as string
  const styles: Record<string, string> = {
    delivered:
      "border-emerald-700/30 bg-emerald-50 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/50 dark:text-emerald-100",
    opened:
      "border-teal-600/30 bg-teal-50 text-teal-900 dark:border-teal-600/40 dark:bg-teal-950/40 dark:text-teal-100",
    sent:
      "border-blue-600/30 bg-blue-50 text-blue-900 dark:border-blue-600/40 dark:bg-blue-950/40 dark:text-blue-100",
    bounced:
      "border-red-600/30 bg-red-50 text-red-900 dark:border-red-600/40 dark:bg-red-950/50 dark:text-red-100",
    failed:
      "border-red-600/30 bg-red-50 text-red-900 dark:border-red-600/40 dark:bg-red-950/50 dark:text-red-100",
    skipped:
      "border-amber-600/30 bg-amber-50 text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-100",
    queued:
      "border-stone-300 bg-stone-100 text-stone-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase",
        styles[key] ?? styles.queued,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden />
      {capitalize(status)}
    </span>
  )
}

export function CommunicationsTab({
  propertyId,
  reservationId,
}: {
  propertyId: string
  reservationId: string
}) {
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<StatusOption>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchLogs = useCallback(async () => {
    const offset = (page - 1) * PAGE_SIZE
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        propertyId,
        reservationId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      const res = await fetch(`/api/v1/communications/log?${params}`)
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to load communications")
      }
      setLogs((json.data.data ?? []) as CommunicationLog[])
      setTotalCount(json.data.count ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load communications")
    } finally {
      setLoading(false)
    }
  }, [propertyId, reservationId, page])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const filteredLogs = useMemo(() => {
    let result = logs
    if (channelFilter !== "all") {
      result = result.filter((l) => l.channel === channelFilter)
    }
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status.toLowerCase() === statusFilter)
    }
    return result
  }, [logs, channelFilter, statusFilter])

  return (
    <PermissionGate
      permission="guest_comms.view_delivery_log"
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Mail className="h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">
            You don&apos;t have permission to view communications.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Channel filter buttons */}
            {CHANNEL_OPTIONS.map((ch) => (
              <Button
                key={ch}
                type="button"
                variant={channelFilter === ch ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setChannelFilter(ch)}
              >
                {ch === "all"
                  ? "All"
                  : ch === "EMAIL"
                    ? "Email"
                    : "SMS"}
              </Button>
            ))}

            {/* Status filter dropdown */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusOption)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs capitalize">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {totalCount > 0 && !loading && (
            <p className="text-xs text-muted-foreground">
              {totalCount} communication{totalCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Error state */}
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <MessageSquare className="h-10 w-10 text-red-400" aria-hidden />
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        ) : null}

        {/* Loading state */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredLogs.length === 0 && !error ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-medium text-muted-foreground">
              No communications sent for this reservation
            </p>
            <p className="max-w-md text-xs text-muted-foreground/70">
              Messages will appear here when automations send booking confirmations,
              reminders, or other guest communications.
            </p>
          </div>
        ) : !error ? (
          /* Table */
          <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/90">
            <Table>
              <TableHeader>
                <TableRow className="border-stone-100 hover:bg-transparent dark:border-zinc-800">
                  <TableHead className="w-8" />
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Date/Time
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Template
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Channel
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Recipient
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id
                  return (
                    <>
                      <TableRow
                        key={log.id}
                        className="cursor-pointer border-stone-100 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <TableCell className="w-8 pl-4">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-stone-600 dark:text-zinc-300">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-stone-900 dark:text-zinc-50">
                          {log.template?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase text-stone-700 dark:text-zinc-200">
                            {log.channel === "SMS" ? (
                              <Smartphone className="h-3.5 w-3.5 text-stone-500" aria-hidden />
                            ) : (
                              <Mail className="h-3.5 w-3.5 text-stone-500" aria-hidden />
                            )}
                            {log.channel}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={log.status} />
                        </TableCell>
                        <TableCell className="text-sm text-stone-600 dark:text-zinc-300">
                          {log.recipient_address ?? "—"}
                        </TableCell>
                      </TableRow>
                      {/* Expanded detail row */}
                      {isExpanded && (
                        <TableRow key={`${log.id}-detail`} className="border-stone-100 dark:border-zinc-800 hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-stone-50/60 px-8 py-4 dark:bg-zinc-950/50">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">
                                  Subject
                                </p>
                                <p className="text-sm text-stone-900 dark:text-zinc-50">
                                  {log.subject ?? "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">
                                  Recipient
                                </p>
                                <p className="text-sm text-stone-900 dark:text-zinc-50">
                                  {log.recipient_address ?? "—"}
                                </p>
                              </div>
                              {log.bounce_type && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">
                                    Bounce Type
                                  </p>
                                  <p className="text-sm text-red-700 dark:text-red-400 capitalize">
                                    {log.bounce_type.replaceAll("_", " ")}
                                  </p>
                                </div>
                              )}
                              {log.failure_reason && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">
                                    Failure Reason
                                  </p>
                                  <p className="text-sm text-red-700 dark:text-red-400">
                                    {log.failure_reason}
                                  </p>
                                </div>
                              )}
                              {log.opened_at && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">
                                    Opened
                                  </p>
                                  <p className="text-sm text-stone-700 dark:text-zinc-300">
                                    {formatDateTime(log.opened_at)}
                                  </p>
                                </div>
                              )}
                              {log.clicked_at && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">
                                    Clicked
                                  </p>
                                  <p className="text-sm text-stone-700 dark:text-zinc-300">
                                    {formatDateTime(log.clicked_at)}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 rounded-md border border-dashed border-stone-200 bg-white/60 px-4 py-3 text-center text-xs text-stone-400 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-500">
                              Message preview not available — {log.subject ?? "the message content"} was sent via {log.channel.toLowerCase()}.
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-end border-t border-stone-100 px-4 py-3 dark:border-zinc-800">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PermissionGate>
  )
}
