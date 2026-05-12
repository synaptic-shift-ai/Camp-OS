"use client"

import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Filter,
  Mail,
  Smartphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

const ACTIVITY_ROWS: ActivityRow[] = [
  {
    id: "1",
    when: "2m ago",
    guest: "Sarah Mitchell",
    template: "Booking Confirmation",
    channel: "EMAIL",
    status: "Delivered",
    reservation: "#R-48231",
  },
  {
    id: "2",
    when: "12m ago",
    guest: "James Porter",
    template: "Check-In Day",
    channel: "SMS",
    status: "Opened",
    reservation: "#R-48102",
  },
  {
    id: "3",
    when: "1h ago",
    guest: "Unknown",
    template: "Promo — Spring",
    channel: "EMAIL",
    status: "Bounced",
    reservation: "—",
  },
  {
    id: "4",
    when: "2h ago",
    guest: "Elena Ruiz",
    template: "Balance Reminder",
    channel: "SMS",
    status: "Skipped",
    reservation: "#R-47988",
  },
  {
    id: "5",
    when: "3h ago",
    guest: "Marcus Lin",
    template: "Pre-Arrival Info",
    channel: "EMAIL",
    status: "Queued",
    reservation: "#R-47844",
  },
]

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

export function GuestDeliveryPanel() {
  const [query, setQuery] = useState("")

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ACTIVITY_ROWS
    return ACTIVITY_ROWS.filter(
      (r) =>
        r.guest.toLowerCase().includes(q) ||
        r.reservation.toLowerCase().includes(q) ||
        r.template.toLowerCase().includes(q),
    )
  }, [query])

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
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              12%
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">1,284</p>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">vs. yesterday</p>
        </div>

        <div className={cn(CARD, "border-l-4", GREEN)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
              Delivery rate
            </p>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              0.3%
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">98.6%</p>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Email + SMS combined</p>
        </div>

        <div className={cn(CARD, "border-l-4", GREEN)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
              Open rate
            </p>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              4%
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">62.1%</p>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Email only · 24h</p>
        </div>

        <div className={cn(CARD, "border-l-4", AMBER)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
              Bounce rate
            </p>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              0.2%
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">1.3%</p>
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
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-stone-600 dark:text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Mail className="h-3.5 w-3.5 text-emerald-800 dark:text-emerald-400" aria-hidden />
                  Email
                </span>
                <span className="tabular-nums text-stone-500 dark:text-zinc-400">6,420 · 78%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-[hsl(142.1,76.2%,32%)] dark:bg-[hsl(142.1,55%,40%)]"
                  style={{ width: "78%" }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-stone-600 dark:text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Smartphone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                  SMS
                </span>
                <span className="tabular-nums text-stone-500 dark:text-zinc-400">1,812 · 22%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                <div className="h-full w-[22%] rounded-full bg-amber-500 dark:bg-amber-600" />
              </div>
            </div>
          </div>
        </div>

        <div className={cn(CARD, "flex min-h-[200px] flex-col")}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-50">
              Send volume · last 14 days
            </h3>
            <span className="text-xs text-stone-500 dark:text-zinc-400">Peak: Sat 9am</span>
          </div>
          <div className="mt-auto flex flex-1 items-center justify-center rounded-lg border border-dashed border-stone-200 bg-stone-50/80 py-12 text-center text-xs text-stone-400 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-500">
            Chart placeholder — connect analytics to render send volume.
          </div>
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
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No rows match your search.
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
      </div>
    </div>
  )
}
