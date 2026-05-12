"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Filter,
  Mail,
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

const PANEL =
  "rounded-xl bg-[#f7f5f0] text-stone-900 dark:bg-zinc-950 dark:text-zinc-100"
const CARD = "rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90"

const GREEN = "border-l-[hsl(142.1,76.2%,32%)]"
const AMBER = "border-l-amber-500"

type ActivityRow = {
  id: string
  when: string
  guest: string
  template: string
  channel: "EMAIL" | "SMS"
  status: "Delivered" | "Opened" | "Bounced" | "Skipped" | "Queued"
  reservation: string
}

type StatusCounts = {
  counts: Record<string, number>
  total: number
}

type LogEntry = {
  id: string
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

function StatusBadge({ status }: { status: ActivityRow["status"] }) {
  const styles: Record<ActivityRow["status"], string> = {
    Delivered:
      "border-emerald-700/30 bg-emerald-50 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/50 dark:text-emerald-100",
    Opened:
      "border-teal-600/30 bg-teal-50 text-teal-900 dark:border-teal-600/40 dark:bg-teal-950/40 dark:text-teal-100",
    Bounced:
      "border-red-600/30 bg-red-50 text-red-900 dark:border-red-600/40 dark:bg-red-950/50 dark:text-red-100",
    Skipped:
      "border-amber-600/30 bg-amber-50 text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-100",
    Queued:
      "border-stone-300 bg-stone-100 text-stone-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase",
        styles[status],
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
          ? "text-emerald-700 dark:text-emerald-400"
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

export function GuestDeliveryPanel() {
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

  const pageSize = 10

  // Fetch status counts (KPIs)
  useEffect(() => {
    let cancelled = false
    async function fetchCounts() {
      try {
        setLoadingKpi(true)
        const res = await fetch(`/api/v1/communications/log?groupBy=status&dateFrom=${new Date().toISOString().split("T")[0]}`)
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
  }, [])

  // Fetch channel mix (last 7 days)
  useEffect(() => {
    let cancelled = false
    async function fetchChannelMix() {
      try {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const from = sevenDaysAgo.toISOString().split("T")[0]
        const res = await fetch(`/api/v1/communications/log?dateFrom=${from}&limit=10000`)
        const json = await res.json()
        if (cancelled || !json.success) return

        const entries: LogEntry[] = json.data.data ?? []
        let email = 0
        let sms = 0
        for (const e of entries) {
          if (e.channel === "EMAIL") email++
          else if (e.channel === "SMS") sms++
        }
        const total = email + sms
        setChannelMix({ email, sms, total })
      } catch {
        // silent
      }
    }
    fetchChannelMix()
    return () => { cancelled = true }
  }, [])

  // Fetch chart data (last 14 days)
  useEffect(() => {
    let cancelled = false
    async function fetchChartData() {
      try {
        setLoadingChart(true)
        const fourteenDaysAgo = new Date()
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
        const from = fourteenDaysAgo.toISOString().split("T")[0]
        const res = await fetch(`/api/v1/communications/log?dateFrom=${from}&limit=10000`)
        const json = await res.json()
        if (cancelled || !json.success) return

        const entries: LogEntry[] = json.data.data ?? []
        const dayMap: Record<string, { EMAIL: number; SMS: number }> = {}

        for (let i = 0; i < 14; i++) {
          const d = new Date()
          d.setDate(d.getDate() - (13 - i))
          const key = d.toISOString().split("T")[0] ?? ""
          dayMap[key] = { EMAIL: 0, SMS: 0 }
        }

        for (const e of entries) {
          const day = e.created_at ? e.created_at.split("T")[0] : undefined
          if (day && dayMap[day]) {
            if (e.channel === "EMAIL") dayMap[day].EMAIL++
            else if (e.channel === "SMS") dayMap[day].SMS++
          }
        }

        const points: ChartDataPoint[] = Object.entries(dayMap).map(([date, counts]) => ({
          date: new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          ...counts,
        }))

        setChartData(points)
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingChart(false)
      }
    }
    fetchChartData()
    return () => { cancelled = true }
  }, [])

  // Fetch activity logs
  useEffect(() => {
    let cancelled = false
    async function fetchLogs() {
      try {
        setLoadingLogs(true)
        const offset = (logPage - 1) * pageSize
        const res = await fetch(`/api/v1/communications/log?limit=${pageSize}&offset=${offset}`)
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
  }, [logPage])

  // Compute KPIs
  const kpis = useMemo(() => {
    const c = statusCounts?.counts ?? {}
    const sent = (c.queued ?? 0) + (c.sent ?? 0) + (c.delivered ?? 0) + (c.opened ?? 0) + (c.bounced ?? 0) + (c.failed ?? 0)
    const delivered = (c.delivered ?? 0) + (c.opened ?? 0)
    const bounced = c.bounced ?? 0
    const failed = c.failed ?? 0
    const opened = c.opened ?? 0
    const total = statusCounts?.total ?? 0

    const deliveryRate = (delivered + bounced + failed) > 0
      ? ((delivered / (delivered + bounced + failed)) * 100).toFixed(1)
      : "—"
    const openRate = delivered > 0
      ? ((opened / delivered) * 100).toFixed(1)
      : "—"
    const bounceRate = total > 0
      ? ((bounced / total) * 100).toFixed(1)
      : "—"

    return { sent, deliveryRate, openRate, bounceRate }
  }, [statusCounts])

  // Map log entries to activity rows
  const activityRows: ActivityRow[] = useMemo(() => {
    return logs.map((entry) => {
      const guest = entry.guest
      const firstName = guest?.first_name ?? ""
      const lastName = guest?.last_name ?? ""
      const guestName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown"

      return {
        id: entry.id,
        when: formatRelativeTime(entry.created_at),
        guest: guestName,
        template: entry.template?.name ?? "—",
        channel: (entry.channel as "EMAIL" | "SMS") ?? "EMAIL",
        status: capitalize(entry.status) as ActivityRow["status"],
        reservation: entry.reservation_id ? `#${entry.reservation_id}` : "—",
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

  const totalPages = Math.max(1, Math.ceil(logCount / pageSize))

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
      <header className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-50 sm:text-3xl">
          Delivery overview
        </h2>
        <p className="text-sm text-stone-500 dark:text-zinc-400">
          How your guest communications are performing today.
        </p>
      </header>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cn(CARD, "border-l-4", GREEN)}>
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

        <div className={cn(CARD, "border-l-4", GREEN)}>
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

        <div className={cn(CARD, "border-l-4", GREEN)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
              Open rate
            </p>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">
            {loadingKpi ? <Skeleton className="inline-block h-8 w-20" /> : `${kpis.openRate}%`}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Email only · 24h</p>
        </div>

        <div className={cn(CARD, "border-l-4", AMBER)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
              Bounce rate
            </p>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">
            {loadingKpi ? <Skeleton className="inline-block h-8 w-20" /> : `${kpis.bounceRate}%`}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Within 2% target</p>
        </div>
      </div>

      {/* Channel mix + Send volume */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(CARD, "space-y-4")}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-50">Channel mix</h3>
            <span className="text-xs text-stone-500 dark:text-zinc-400">Last 7 days</span>
          </div>
          {channelMix.total === 0 && !loadingKpi ? (
            <p className="py-4 text-center text-sm text-stone-400 dark:text-zinc-500">No data yet</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-stone-600 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Mail className="h-3.5 w-3.5 text-emerald-800 dark:text-emerald-400" aria-hidden />
                    Email
                  </span>
                  <span className="tabular-nums text-stone-500 dark:text-zinc-400">
                    {loadingKpi ? <Skeleton className="inline-block h-4 w-20" /> : `${channelMix.email.toLocaleString()} · ${emailPct}%`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-[hsl(142.1,76.2%,32%)] dark:bg-[hsl(142.1,55%,40%)] transition-all duration-500"
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
                    {loadingKpi ? <Skeleton className="inline-block h-4 w-20" /> : `${channelMix.sms.toLocaleString()} · ${smsPct}%`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                  <div
                    className="h-full w-[22%] rounded-full bg-amber-500 dark:bg-amber-600 transition-all duration-500"
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
              {loadingChart ? "" : `${channelMix.total} total`}
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
                    fill="hsl(142.1, 76.2%, 32%)"
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
      <div className={cn(CARD, "space-y-4 p-0")}>
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-50">Recent activity</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Every send is logged and linked to a reservation.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guest or reservation…"
              className="h-9 border-stone-200 bg-white text-stone-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filter
            </Button>
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
                  No activity recorded yet.
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
                        className="text-sm font-medium text-emerald-800 underline-offset-4 hover:underline dark:text-emerald-400"
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
