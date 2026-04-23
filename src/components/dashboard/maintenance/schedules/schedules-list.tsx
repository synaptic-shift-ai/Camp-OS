"use client"

import { CalendarCheck2, Clock3, MapPin, User2 } from "lucide-react"
import { cn } from "@/lib/utils"

type ScheduleFrequency = "weekly" | "monthly" | "seasonal" | "annual" | "quarterly"

type ScheduleCard = {
  id: string
  title: string
  location: string
  assignee: string
  frequency: ScheduleFrequency
  nextDueLabel: string
}

const SCHEDULES: ScheduleCard[] = [
  {
    id: "PM-01",
    title: "Weekly electrical inspection",
    location: "All pedestals",
    assignee: "Dale Hopper",
    frequency: "weekly",
    nextDueLabel: "Fri, Apr 25",
  },
  {
    id: "PM-02",
    title: "Monthly plumbing check",
    location: "Bathhouses N & S",
    assignee: "Jesse Kim",
    frequency: "monthly",
    nextDueLabel: "May 01",
  },
  {
    id: "PM-03",
    title: "Seasonal winterization",
    location: "All cabins",
    assignee: "Pat O'Shea",
    frequency: "seasonal",
    nextDueLabel: "Oct 15",
  },
  {
    id: "PM-04",
    title: "Annual full property inspection",
    location: "Entire property",
    assignee: "Maria Vega",
    frequency: "annual",
    nextDueLabel: "Jun 10",
  },
  {
    id: "PM-05",
    title: "Septic tank inspection",
    location: "Sewer system",
    assignee: "Sam Reed",
    frequency: "quarterly",
    nextDueLabel: "May 20",
  },
]

const frequencyStyles: Record<ScheduleFrequency, string> = {
  weekly: "bg-sky-50 text-sky-700 border-sky-200",
  monthly: "bg-emerald-50 text-emerald-700 border-emerald-200",
  seasonal: "bg-amber-50 text-amber-700 border-amber-200",
  annual: "bg-rose-50 text-rose-700 border-rose-200",
  quarterly: "bg-orange-50 text-orange-700 border-orange-200",
}

export function SchedulesList() {
  return (
    <section className="space-y-5 rounded-2xl">

      <div className="grid gap-4 lg:grid-cols-2">
        {SCHEDULES.map((schedule) => (
          <article
            key={schedule.id}
            className="rounded-2xl border border-neutral-200 bg-transparent p-4 shadow-sm sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1F6B45] text-white">
                <CalendarCheck2 className="h-4 w-4" aria-hidden />
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
                  frequencyStyles[schedule.frequency],
                )}
              >
                <Clock3 className="mr-1 h-3.5 w-3.5" aria-hidden />
                {schedule.frequency}
              </span>
            </div>

            <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {schedule.id}
            </p>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{schedule.title}</h3>

            <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {schedule.location}
              </p>
              <p className="flex items-center gap-2">
                <User2 className="h-3.5 w-3.5" aria-hidden />
                {schedule.assignee}
              </p>
            </div>

            <div className="my-4 h-px bg-border/80" />

            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Next Due
                </p>
                <p className="text-2xl font-semibold tracking-tight text-foreground">{schedule.nextDueLabel}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-[#0F5A37] underline-offset-4 hover:underline"
              >
                View →
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
