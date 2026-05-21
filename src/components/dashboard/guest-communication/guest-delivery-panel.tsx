"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Mail,
  Search,
  Smartphone,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

const PANEL = "text-stone-900 dark:text-zinc-100"
const CARD = "rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90"

const RED = "border-l-primary"

type ActivityRow = {
  id: string
  when: string
  guest: string
  template: string
  channel: "EMAIL" | "SMS"
  status: string
  reservation: string
}

type ActivityChannelFilter = "all" | "email" | "sms"

type ActivityStatusFilter =
  | "all"
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "bounced"
  | "failed"
  | "skipped"

const ACTIVITY_STATUS_FILTER_OPTIONS: { value: ActivityStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "opened", label: "Opened" },
  { value: "bounced", label: "Bounced" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
]

type StatusCounts = {
  counts: Record<string, number>
  total: number
}

type LogEntry = {
  id: string
  reservation: { confirmation_number: string } | null
  guest: { first_name: string; last_name: string; email: string } | null
  template: { name: string } | null
  channel: string
  status: string
  reservation_id: string | null
  recipient_address: string
  created_at: string
}

type ChartDataPoint = {
  date: string
  EMAIL: number
  SMS: number
}

const AGGREGATE_PAGE_SIZE = 10_000
const AGGREGATE_FETCH_MAX_ROWS = 500_000

function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfLocalToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function localDateKeyFromIso(iso: string): string {
  return formatLocalDateKey(new Date(iso))
}

function formatChartAxisLabel(isoDateKey: string): string {
  const parts = isoDateKey.split("-").map((x) => Number(x))
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return isoDateKey
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

async function fetchAllCommunicationLogsForAggregate(
  propertyId: string,
  dateFrom: string,
  options?: { signal?: AbortSignal },
): Promise<LogEntry[]> {
  const out: LogEntry[] = []
  let offset = 0
  let total: number | null = null

  for (;;) {
    const params = new URLSearchParams({
      propertyId,
      dateFrom,
      limit: String(AGGREGATE_PAGE_SIZE),
      offset: String(offset),
      aggregate: "1",
    })
    const res = await fetch(
      `/api/v1/communications/log?${params}`,
      options?.signal !== undefined ? { signal: options.signal } : {},
    )
    const json = await res.json()
    if (!json.success) break
    const batch: LogEntry[] = json.data.data ?? []
    if (offset === 0 && typeof json.data.count === "number") {
      total = json.data.count
    }
    out.push(...batch)
    if (batch.length < AGGREGATE_PAGE_SIZE) break
    if (total !== null && out.length >= total) break
    offset += AGGREGATE_PAGE_SIZE
    if (out.length >= AGGREGATE_FETCH_MAX_ROWS) break
  }
  return out
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Delivered:
      "border-red-700/30 bg-red-50 text-red-900 dark:border-red-600/40 dark:bg-red-950/50 dark:text-red-100",
    Opened:
      "border-teal-600/30 bg-teal-50 text-teal-900 dark:border-teal-600/40 dark:bg-teal-950/40 dark:text-teal-100",
    Sent:
      "border-blue-600/30 bg-blue-50 text-blue-900 dark:border-blue-600/40 dark:bg-blue-950/40 dark:text-blue-100",
    Bounced:
      "border-red-600/30 bg-red-50 text-red-900 dark:border-red-600/40 dark:bg-red-950/50 dark:text-red-100",
    Skipped:
      "border-amber-600/30 bg-amber-50 text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-100",
    Queued:
      "border-stone-300 bg-stone-100 text-stone-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
    Failed:
      "border-red-600/30 bg-red-50 text-red-900 dark:border-red-600/40 dark:bg-red-950/50 dark:text-red-100",
  }
  const cls = styles[status] ?? styles.Queued
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase",
        cls,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden />
      {status}
    </span>
  )
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function TrendArrow({ direction, value }: { direction: "up" | "down"; value: string }) {
  const isGood = direction === "up"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        isGood
          ? "text-red-700 dark:text-red-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      {direction === "up" ? (
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      )}
      {value}
    </span>
  )
}

export function GuestDeliveryPanel({ propertyId }: { propertyId: string }) {
  const [query, setQuery] = useState("")
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logCount, setLogCount] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [loadingKpi, setLoadingKpi] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loadingChart, setLoadingChart] = useState(true)
  const [channelMix, setChannelMix] = useState<{ email: number; sms: number; total: number }>({
    email: 0,
    sms: 0,
    total: 0,
  })
  const [activityChannelFilter, setActivityChannelFilter] =
    useState<ActivityChannelFilter>("all")
  const [activityStatusFilter, setActivityStatusFilter] =
    useState<ActivityStatusFilter>("all")

  const pageSize = 10

  const activityFiltersActive =
    activityChannelFilter !== "all" || activityStatusFilter !== "all"

  useEffect(() => {
    setLogPage(1)
  }, [activityChannelFilter, activityStatusFilter])

  // Fetch status counts (KPIs)
  useEffect(() => {
    let cancelled = false
    async function fetchCounts() {
      try {
        setLoadingKpi(true)
        const res = await fetch(
          `/api/v1/communications/log?propertyId=${propertyId}&groupBy=status&dateFrom=${new Date().toISOString().split("T")[0]}`,
        )
        const json = await res.json()
        if (cancelled || !json.success) return
        setStatusCounts(json.data)
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingKpi(false)
      }
    }
    fetchCounts()
    return () => { cancelled = true }
  }, [propertyId])

  // Channel mix (last 7 days) + send volume (last 14 days): one paginated aggregate fetch
  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    async function fetchDeliveryAggregates() {
      try {
        setLoadingChart(true)
        const today = startOfLocalToday()
        const fourteenAgo = new Date(today)
        fourteenAgo.setDate(fourteenAgo.getDate() - 13)
        const from14 = formatLocalDateKey(fourteenAgo)

        const sevenAgo = new Date(today)
        sevenAgo.setDate(sevenAgo.getDate() - 7)
        const from7 = formatLocalDateKey(sevenAgo)

        const entries = await fetchAllCommunicationLogsForAggregate(propertyId, from14, { signal: ac.signal })
        if (cancelled) return

        const dayMap: Record<string, { EMAIL: number; SMS: number }> = {}
        for (let i = 13; i >= 0; i--) {
          const d = new Date(today)
          d.setDate(d.getDate() - i)
          dayMap[formatLocalDateKey(d)] = { EMAIL: 0, SMS: 0 }
        }

        let email7 = 0
        let sms7 = 0
        for (const e of entries) {
          const ch = e.channel?.toUpperCase()
          const dayKey = localDateKeyFromIso(e.created_at)
          if (dayKey >= from7) {
            if (ch === "EMAIL") email7++
            else if (ch === "SMS") sms7++
          }
          if (dayMap[dayKey]) {
            if (ch === "EMAIL") dayMap[dayKey].EMAIL++
            else if (ch === "SMS") dayMap[dayKey].SMS++
          }
        }

        const orderedKeys = Object.keys(dayMap).sort()
        const points: ChartDataPoint[] = orderedKeys.map((key) => {
          const counts = dayMap[key] ?? { EMAIL: 0, SMS: 0 }
          return {
            date: formatChartAxisLabel(key),
            EMAIL: counts.EMAIL,
            SMS: counts.SMS,
          }
        })

        setChannelMix({ email: email7, sms: sms7, total: email7 + sms7 })
        setChartData(points)
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingChart(false)
      }
    }
    fetchDeliveryAggregates()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [propertyId])

  // Fetch activity logs
  useEffect(() => {
    let cancelled = false
    async function fetchLogs() {
      try {
        setLoadingLogs(true)
        const offset = (logPage - 1) * pageSize
        const params = new URLSearchParams({
          propertyId,
          limit: String(pageSize),
          offset: String(offset),
        })
        if (activityChannelFilter !== "all") {
          params.set("channel", activityChannelFilter)
        }
        if (activityStatusFilter !== "all") {
          params.set("status", activityStatusFilter)
        }
        const res = await fetch(`/api/v1/communications/log?${params.toString()}`)
        const json = await res.json()
        if (cancelled || !json.success) return
        setLogs(json.data.data ?? [])
        setLogCount(json.data.count ?? 0)
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingLogs(false)
      }
    }
    fetchLogs()
    return () => { cancelled = true }
  }, [propertyId, logPage, activityChannelFilter, activityStatusFilter])

  // Compute KPIs
  const kpis = useMemo(() => {
    const c = statusCounts?.counts ?? {}
    const sent = (c.queued ?? 0) + (c.sent ?? 0) + (c.delivered ?? 0) + (c.opened ?? 0) + (c.bounced ?? 0) + (c.failed ?? 0)
    const delivered = (c.delivered ?? 0) + (c.opened ?? 0)
    const bounced = c.bounced ?? 0
    const failed = c.failed ?? 0

    const deliveryRate = (delivered + bounced + failed) > 0
      ? ((delivered / (delivered + bounced + failed)) * 100).toFixed(1)
      : "—"

    return { sent, deliveryRate }
  }, [statusCounts])

  // Map log entries to activity rows
  const activityRows: ActivityRow[] = useMemo(() => {
    return logs.map((entry) => {
      const guest = entry.guest
      const firstName = guest?.first_name ?? ""
      const lastName = guest?.last_name ?? ""
      const guestName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown"

      const rawChannel = entry.channel?.toUpperCase()
      const channel: ActivityRow["channel"] = rawChannel === "SMS" ? "SMS" : "EMAIL"

      return {
        id: entry.id,
        when: formatRelativeTime(entry.created_at),
        guest: guestName,
        template: entry.template?.name ?? "—",
        channel,
        status: capitalize(entry.status),
        reservation: entry.reservation?.confirmation_number
          ? `#${entry.reservation.confirmation_number}`
          : "—",
      }
    })
  }, [logs])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return activityRows
    return activityRows.filter(
      (r) =>
        r.guest.toLowerCase().includes(q) ||
        r.reservation.toLowerCase().includes(q) ||
        r.template.toLowerCase().includes(q),
    )
  }, [query, activityRows])

  const emptyActivityMessage = useMemo(() => {
    if (logCount === 0 && activityFiltersActive) {
      return "No activity matches these filters."
    }
    if (activityRows.length > 0 && filteredRows.length === 0 && query.trim()) {
      return "No results match your search."
    }
    return "No activity recorded yet."
  }, [logCount, activityFiltersActive, activityRows.length, filteredRows.length, query])

  const totalPages = Math.max(1, Math.ceil(logCount / pageSize))

  const chartVolumeTotal14 = useMemo(
    () => chartData.reduce((sum, d) => sum + d.EMAIL + d.SMS, 0),
    [chartData],
  )

  // Channel mix percentages
  const emailPct = channelMix.total > 0 ? Math.round((channelMix.email / channelMix.total) * 100) : 0
  const smsPct = channelMix.total > 0 ? 100 - emailPct : 0

  return (
    <div
      id="guest-comm-panel-delivery"
      role="tabpanel"
      aria-labelledby="guest-comm-tab-delivery"
      className={cn("space-y-6", PANEL)}
    >
      {/* <header className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-50 sm:text-3xl">
          Delivery overview
        </h2>
        <p className="text-sm text-stone-500 dark:text-zinc-400">
          How your guest communications are performing today.
        </p>
      </header> */}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={cn(CARD, "border-l-4", RED)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
              Sent today
            </p>
            {loadingKpi ? (
              <Skeleton className="h-4 w-12" />
            ) : (
              <TrendArrow direction="up" value="—" />
            )}
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">
            {loadingKpi ? <Skeleton className="inline-block h-8 w-20" /> : kpis.sent.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Email + SMS combined</p>
        </div>

        <div className={cn(CARD, "border-l-4", RED)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
              Delivery rate
            </p>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">
            {loadingKpi ? <Skeleton className="inline-block h-8 w-20" /> : `${kpis.deliveryRate}%`}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Email + SMS combined</p>
        </div>
      </div>

      {/* Channel mix + Send volume */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(CARD, "space-y-4")}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-50">Channel mix</h3>
            <span className="text-xs text-stone-500 dark:text-zinc-400">Last 7 days</span>
          </div>
          {channelMix.total === 0 && !loadingChart ? (
            <p className="py-4 text-center text-sm text-stone-400 dark:text-zinc-500">No data yet</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-stone-600 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Mail className="h-3.5 w-3.5 text-red-800 dark:text-red-400" aria-hidden />
                    Email
                  </span>
                  <span className="tabular-nums text-stone-500 dark:text-zinc-400">
                    {loadingChart ? <Skeleton className="inline-block h-4 w-20" /> : `${channelMix.email.toLocaleString()} · ${emailPct}%`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${emailPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-stone-600 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Smartphone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                    SMS
                  </span>
                  <span className="tabular-nums text-stone-500 dark:text-zinc-400">
                    {loadingChart ? <Skeleton className="inline-block h-4 w-20" /> : `${channelMix.sms.toLocaleString()} · ${smsPct}%`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-amber-500 dark:bg-amber-600 transition-all duration-500"
                    style={{ width: `${smsPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={cn(CARD, "flex min-h-[200px] flex-col")}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-50">
              Send volume · last 14 days
            </h3>
            <span className="text-xs text-stone-500 dark:text-zinc-400">
              {loadingChart ? "" : `${chartVolumeTotal14.toLocaleString()} total`}
            </span>
          </div>
          {loadingChart ? (
            <div className="mt-auto flex flex-1 items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="mt-auto flex-1">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-zinc-700" />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  <Bar
                    dataKey="EMAIL"
                    name="Email"
                    stackId="a"
                    fill="#e11c48"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="SMS"
                    name="SMS"
                    stackId="a"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-auto flex flex-1 items-center justify-center rounded-lg border border-dashed border-stone-200 bg-stone-50/80 py-12 text-center text-xs text-stone-400 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-500">
              No send data yet for the last 14 days.
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className={cn(CARD, "space-y-0 p-0")}>
        <div className="space-y-4 border-b border-stone-100 px-4 py-4 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-50">Recent activity</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Every send is logged and linked to a reservation.
            </p>
          </div>

          <div className="border border-border/80 bg-card/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                <label
                  htmlFor="delivery-activity-search"
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Search
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="delivery-activity-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by guest, reservation, or template…"
                    className="h-9 rounded-none bg-card/50 pl-8 text-sm"
                    aria-label="Search delivery activity"
                  />
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <label
                  htmlFor="delivery-channel-filter"
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Channel
                </label>
                <Select
                  value={activityChannelFilter}
                  onValueChange={(v) => setActivityChannelFilter(v as ActivityChannelFilter)}
                >
                  <SelectTrigger id="delivery-channel-filter" className="h-9 w-full rounded-none bg-card/50">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0 space-y-1">
                <label
                  htmlFor="delivery-status-filter"
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Status
                </label>
                <Select
                  value={activityStatusFilter}
                  onValueChange={(v) => setActivityStatusFilter(v as ActivityStatusFilter)}
                >
                  <SelectTrigger id="delivery-status-filter" className="h-9 w-full rounded-none bg-card/50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {ACTIVITY_STATUS_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activityFiltersActive ? (
              <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground"
                  onClick={() => {
                    setActivityChannelFilter("all")
                    setActivityStatusFilter("all")
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-stone-100 hover:bg-transparent dark:border-zinc-800">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                When
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                Guest
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
                Reservation
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingLogs ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-stone-100 dark:border-zinc-800">
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  {emptyActivityMessage}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-stone-100 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                >
                  <TableCell className="whitespace-nowrap text-sm text-stone-600 dark:text-zinc-300">
                    {row.when}
                  </TableCell>
                  <TableCell className="font-semibold text-stone-900 dark:text-zinc-50">{row.guest}</TableCell>
                  <TableCell className="text-sm text-stone-700 dark:text-zinc-300">{row.template}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase text-stone-700 dark:text-zinc-200">
                      {row.channel === "EMAIL" ? (
                        <Mail className="h-3.5 w-3.5 text-stone-500" aria-hidden />
                      ) : (
                        <Smartphone className="h-3.5 w-3.5 text-stone-500" aria-hidden />
                      )}
                      {row.channel}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    {row.reservation === "—" ? (
                      <span className="text-sm text-stone-400">—</span>
                    ) : (
                      <button
                        type="button"
                        className="text-sm font-medium text-red-800 underline-offset-4 hover:underline dark:text-red-400"
                      >
                        {row.reservation}
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-end border-t border-stone-100 px-4 py-3 dark:border-zinc-800">
            <Pagination
              currentPage={logPage}
              totalPages={totalPages}
              onPageChange={setLogPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
