"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Flame,
  Leaf,
  Pause,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const FOREST = "#1A4D2E"
const LIGHT_GREEN = "#A7D7A3"

type CostReportProps = {
  propertyName: string
  userDisplayName: string
  onViewAllWorkOrders?: () => void
}

function firstNameFromDisplay(display: string): string {
  const trimmed = display.trim()
  if (!trimmed) return "there"
  return trimmed.split(/\s+/)[0] ?? trimmed
}

function timeGreeting(date: Date): string {
  const h = date.getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

type StatCard = {
  icon: ReactNode
  iconWrapClass: string
  value: string
  label: string
  trend: string
}

type AttentionRow = {
  id: string
  title: string
  subtitle: string
  priority: "Emergency" | "High" | "Medium" | "Low"
  status: string
  statusVariant: "in_progress" | "vendor" | "open" | "on_hold"
}

const ATTENTION_ROWS: AttentionRow[] = [
  {
    id: "WO-10421",
    title: "No power at Site A12",
    subtitle: "Site A12 · Alex Rivera",
    priority: "Emergency",
    status: "In Progress",
    statusVariant: "in_progress",
  },
  {
    id: "WO-10408",
    title: "Water heater leak — Cabin 4",
    subtitle: "Cabin 4 · Vendor: Lakeside HVAC",
    priority: "High",
    status: "In Progress (Vendor)",
    statusVariant: "vendor",
  },
  {
    id: "WO-10392",
    title: "Replace smoke detector batteries",
    subtitle: "Lodge · Jamie Chen",
    priority: "Medium",
    status: "Open",
    statusVariant: "open",
  },
  {
    id: "WO-10388",
    title: "Trail lighting repair",
    subtitle: "North trailhead · Unassigned",
    priority: "Low",
    status: "On Hold",
    statusVariant: "on_hold",
  },
]

function PriorityBadge({ priority }: { priority: AttentionRow["priority"] }) {
  const config: Record<
    AttentionRow["priority"],
    { className: string; icon: ReactNode; label: string }
  > = {
    Emergency: {
      className: "border-[#FED7D7] bg-[#FFF5F5] text-[#C53030]",
      icon: <Flame className="h-3.5 w-3.5" aria-hidden />,
      label: "Emergency",
    },
    High: {
      className: "border-[#FEEBC8] bg-[#FFFAF0] text-[#C05621]",
      icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
      label: "High",
    },
    Medium: {
      className: "border-[#FEFCBF] bg-[#FFFFF0] text-[#B7791F]",
      icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
      label: "Medium",
    },
    Low: {
      className: "border-[#C6F6D5] bg-[#F0FFF4] text-[#276749]",
      icon: <Leaf className="h-3.5 w-3.5" aria-hidden />,
      label: "Low",
    },
  }
  const c = config[priority]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        c.className,
      )}
    >
      {c.icon}
      {c.label}
    </span>
  )
}

function StatusBadge({ row }: { row: AttentionRow }) {
  const styles: Record<AttentionRow["statusVariant"], string> = {
    in_progress: "border-[#F6E05E]/80 bg-[#FFFFF9] text-[#975A16]",
    vendor: "border-[#E9D8FD] bg-[#FAF5FF] text-[#553C9A]",
    open: "border-[#BEE3F8] bg-[#EBF8FF] text-[#2C5282]",
    on_hold: "border-[#E2E8D0] bg-[#F7FAE8] text-[#744210]",
  }
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[row.statusVariant],
      )}
    >
      {row.status}
    </span>
  )
}

function StatusBarRow({
  label,
  count,
  max,
  barClass,
}: {
  label: string
  count: number
  max: number
  barClass: string
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
        <div className={cn("h-full rounded-full transition-all", barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CostLineChart() {
  const w = 320
  const h = 120
  const pad = 12
  const points = [
    { x: 0, y: 0.55 },
    { x: 0.25, y: 0.45 },
    { x: 0.5, y: 0.62 },
    { x: 0.75, y: 0.38 },
    { x: 1, y: 0.5 },
  ]
  const pathD = points
    .map((p, i) => {
      const x = pad + p.x * (w - pad * 2)
      const y = pad + p.y * (h - pad * 2)
      return `${i === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${w} ${h + 28}`} className="h-auto w-full max-w-full" role="img" aria-label="Cost trend">
      <defs>
        <linearGradient id="costLineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A4D2E" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#1A4D2E" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${pad + (w - pad * 2)} ${h} L ${pad} ${h} Z`}
        fill="url(#costLineGrad)"
      />
      <path
        d={pathD}
        fill="none"
        stroke="#1A4D2E"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {["Feb", "Mar", "Apr"].map((label, i) => (
        <text
          key={label}
          x={pad + (i / 2) * (w - pad * 2)}
          y={h + 20}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px] font-sans"
        >
          {label}
        </text>
      ))}
    </svg>
  )
}

function CategoryDonut() {
  const segments =
    "conic-gradient(#805AD5 0 32%, #4299E1 32% 56%, #DD6B20 56% 74%, #48BB78 74% 88%, #38B2AC 88% 100%)"
  return (
    <div className="relative mx-auto h-44 w-44 shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: segments }}
        aria-hidden
      />
      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-card text-center shadow-inner">
        <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">32</span>
        <span className="text-xs text-muted-foreground">this month</span>
      </div>
    </div>
  )
}

export function CostReport({ propertyName, userDisplayName, onViewAllWorkOrders }: CostReportProps) {
  const [costRange, setCostRange] = useState("12w")
  const greeting = useMemo(() => timeGreeting(new Date()), [])
  const name = useMemo(() => firstNameFromDisplay(userDisplayName), [userDisplayName])

  const statusRows = [
    { label: "Open", count: 6, barClass: "bg-[#BEE3F8]" },
    { label: "In Progress", count: 5, barClass: "bg-[#F6E05E]" },
    { label: "Vendor", count: 2, barClass: "bg-[#D6BCFA]" },
    { label: "On Hold", count: 4, barClass: "bg-[#E2D3A6]" },
    { label: "Complete", count: 18, barClass: "bg-[#9AE6B4]" },
  ]
  const statusMax = Math.max(...statusRows.map((r) => r.count))

  const legend = [
    { label: "Electrical", pct: "32%", swatch: "bg-[#805AD5]" },
    { label: "Plumbing", pct: "24%", swatch: "bg-[#4299E1]" },
    { label: "HVAC", pct: "18%", swatch: "bg-[#DD6B20]" },
    { label: "Facility", pct: "14%", swatch: "bg-[#48BB78]" },
    { label: "Cleaning", pct: "12%", swatch: "bg-[#38B2AC]" },
  ]

  const statCards: StatCard[] = [
    {
      icon: <Wrench className="h-5 w-5 text-[#2B6CB0]" aria-hidden />,
      iconWrapClass: "bg-[#EBF8FF]",
      value: "14",
      label: "Active Work Orders",
      trend: "+3 today",
    },
    {
      icon: <Flame className="h-5 w-5 text-[#C53030]" aria-hidden />,
      iconWrapClass: "bg-[#FFF5F5]",
      value: "2",
      label: "Emergency Issues",
      trend: "1 overdue",
    },
    {
      icon: <Pause className="h-5 w-5 text-[#975A16]" aria-hidden />,
      iconWrapClass: "bg-[#FFFAF0]",
      value: "4",
      label: "On Hold",
      trend: "Waiting parts",
    },
    {
      icon: <Check className="h-5 w-5 text-[#276749]" aria-hidden />,
      iconWrapClass: "bg-[#F0FFF4]",
      value: "7",
      label: "Completed Today",
      trend: "+2 vs avg",
    },
  ]

  return (
    <div className="rounded-2xl p-4 shadow-sm sm:p-6 lg:p-8">
      <header className="mb-8 flex justify-end">
        {onViewAllWorkOrders ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-full border-border bg-card/80 font-sans text-foreground hover:bg-card"
            onClick={onViewAllWorkOrders}
          >
            View all work orders
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-neutral-200/60 bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full",
                  card.iconWrapClass,
                )}
              >
                {card.icon}
              </div>
            </div>
            <p className="mt-4 font-serif text-4xl font-semibold text-foreground">{card.value}</p>
            <p className="mt-1 font-sans text-sm font-medium text-foreground">{card.label}</p>
            <p className="mt-2 font-sans text-xs text-muted-foreground">~ {card.trend}</p>
          </div>
        ))}
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-1">
        <div
          className="flex flex-col justify-between rounded-2xl p-6 text-white shadow-md sm:p-8"
          style={{ backgroundColor: FOREST }}
        >
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Total maintenance cost
            </p>
            <p className="mt-3 font-serif text-5xl font-semibold tracking-tight">$8,420</p>
            <p className="mt-2 font-sans text-sm text-white/80">This month · 32 work orders</p>
          </div>
          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between font-sans text-xs text-white/85">
              <span>Budget vs actual</span>
              <span>84% of $10k</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full"
                style={{ width: "84%", backgroundColor: LIGHT_GREEN }}
              />
            </div>
          </div>
        </div>

        {/* <div className="rounded-2xl border border-neutral-200/60 bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-serif text-xl font-semibold text-foreground">Cost Over Time</h2>
            <Select value={costRange} onValueChange={setCostRange}>
              <SelectTrigger className="h-9 w-full rounded-full border-neutral-200 bg-neutral-50 font-sans text-xs sm:w-[160px]">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12w">Last 12 weeks</SelectItem>
                <SelectItem value="8w">Last 8 weeks</SelectItem>
                <SelectItem value="4w">Last 4 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CostLineChart />
        </div> */}
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200/60 bg-card p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 font-serif text-xl font-semibold text-foreground">Work Orders by Status</h2>
          <div className="space-y-5">
            {statusRows.map((row) => (
              <StatusBarRow
                key={row.label}
                label={row.label}
                count={row.count}
                max={statusMax}
                barClass={row.barClass}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/60 bg-card p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 font-serif text-xl font-semibold text-foreground">Issues by Category</h2>
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
            <CategoryDonut />
            <ul className="w-full max-w-xs space-y-3 font-sans text-sm">
              {legend.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className={cn("h-2.5 w-2.5 rounded-full", item.swatch)} aria-hidden />
                    {item.label}
                  </span>
                  <span className="font-medium text-foreground">{item.pct}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold text-foreground">Attention needed</h2>
          {onViewAllWorkOrders ? (
            <button
              type="button"
              onClick={onViewAllWorkOrders}
              className="font-sans text-sm font-medium text-[#1A4D2E] underline-offset-4 hover:underline"
            >
              See all →
            </button>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-card shadow-sm">
          <ul className="divide-y divide-neutral-100">
            {ATTENTION_ROWS.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted-foreground">{row.id}</p>
                  <p className="mt-1 font-sans text-sm font-semibold text-foreground">{row.title}</p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">{row.subtitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                  <PriorityBadge priority={row.priority} />
                  <StatusBadge row={row} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
