"use client"

import { useEffect, useState } from "react"
import { CalendarCheck2, MoreHorizontal } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
type ScheduleRow = {
  id: string
  name: string
  description: string | null
  site_id: string | null
  assigned_to: string | null
  frequency: string
  days: string | null
  schedule_date: string | null
  created_at: string
}

type SchedulesListProps = {
  propertyId: string
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  onEdit?: ((schedule: ScheduleRow) => void) | undefined
  onDelete?: ((schedule: ScheduleRow) => void) | undefined
  onGenerateNow?: ((scheduleId: string) => void) | undefined
  refreshKey?: number
}

const frequencyStyles: Record<string, string> = {
  weekly: "bg-sky-50 text-sky-700 border-sky-200",
  monthly: "bg-emerald-50 text-emerald-700 border-emerald-200",
  annual: "bg-rose-50 text-rose-700 border-rose-200",
}

/** Weekly uses `days` (weekday name); monthly/annual use `schedule_date`. */
function formatScheduleWhen(schedule: ScheduleRow): string {
  const freq = schedule.frequency.trim().toLowerCase()

  if (freq === "weekly") {
    const day = schedule.days?.trim()
    return day && day.length > 0 ? day : "Not set"
  }

  if (freq === "monthly" || freq === "annual") {
    if (!schedule.schedule_date?.trim()) return "Not set"
    const parsed = new Date(schedule.schedule_date)
    if (Number.isNaN(parsed.getTime())) return "Not set"
    return format(parsed, "MMM d, yyyy")
  }

  if (schedule.schedule_date?.trim()) {
    const parsed = new Date(schedule.schedule_date)
    if (!Number.isNaN(parsed.getTime())) return format(parsed, "MMM d, yyyy")
  }
  const day = schedule.days?.trim()
  return day && day.length > 0 ? day : "Not set"
}

function FrequencyBadge({ frequency }: { frequency: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
        frequencyStyles[frequency] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {frequency}
    </span>
  )
}

function ScheduleActionsMenu({
  schedule,
  onEdit,
  onDelete,
  onGenerateNow,
}: {
  schedule: ScheduleRow
  onEdit?: ((schedule: ScheduleRow) => void) | undefined
  onDelete?: ((schedule: ScheduleRow) => void) | undefined
  onGenerateNow?: ((scheduleId: string) => void) | undefined
}) {
  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Actions for ${schedule.name}`}
            className="h-8 w-8 p-0"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onEdit?.(schedule)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onGenerateNow?.(schedule.id)}>
            Generate Work Order
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete?.(schedule)}
            className="text-red-600 focus:text-red-600"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function MobileCard({
  schedule,
  siteLabel,
  onEdit,
  onDelete,
  onGenerateNow,
}: {
  schedule: ScheduleRow
  siteLabel: string
  onEdit?: ((schedule: ScheduleRow) => void) | undefined
  onDelete?: ((schedule: ScheduleRow) => void) | undefined
  onGenerateNow?: ((scheduleId: string) => void) | undefined
}) {
  return (
    <div className="rounded-md border border-border/80 bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-base font-semibold leading-tight text-foreground"
            title={schedule.name}
          >
            {schedule.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{siteLabel}</p>
        </div>
        <ScheduleActionsMenu schedule={schedule} onEdit={onEdit} onDelete={onDelete} onGenerateNow={onGenerateNow} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-2">
        <FrequencyBadge frequency={schedule.frequency} />
        <p className="text-xs text-muted-foreground">{formatScheduleWhen(schedule)}</p>
      </div>
    </div>
  )
}

export function SchedulesList({
  propertyId,
  siteOptions,
  assigneeOptions,
  onEdit,
  onDelete,
  onGenerateNow,
  refreshKey,
}: SchedulesListProps) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/v1/properties/${propertyId}/maintenance/schedules`,
        )
        const payload = await response.json()

        if (!response.ok || !payload?.success) {
          const message =
            payload?.error?.details?.message ??
            payload?.error?.message ??
            "Failed to load schedules."
          throw new Error(message)
        }

        const list = payload.data?.schedules as ScheduleRow[] | undefined
        if (Array.isArray(list)) {
          setSchedules(list)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load schedules."
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [propertyId, refreshKey])

  const siteLabelById = new Map(siteOptions.map((o) => [o.id, o.label]))
  const assigneeLabelById = new Map(assigneeOptions.map((o) => [o.id, o.label]))

  if (error) {
    return (
      <section className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="rounded-md border border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Loading schedules…
          </div>
        ) : schedules.length === 0 ? (
          <div className="rounded-md border border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            <CalendarCheck2 className="mx-auto mb-2 h-8 w-8 opacity-60" aria-hidden />
            No schedules yet
          </div>
        ) : (
          schedules.map((schedule) => (
            <MobileCard
              key={schedule.id}
              schedule={schedule}
              siteLabel={schedule.site_id ? (siteLabelById.get(schedule.site_id) ?? "Unknown site") : "All sites"}
              onEdit={onEdit}
              onDelete={onDelete}
              onGenerateNow={onGenerateNow}
            />
          ))
        )}
      </div>

      {/* Desktop table — matches maintenance / vendors table shell */}
      <div className="hidden overflow-x-auto border border-border/80 bg-card/50 md:block">
        <Table className="w-full min-w-[720px] table-fixed text-xs lg:min-w-0">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-red-50 uppercase dark:bg-red-950/30">
            <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">Name</TableHead>
              <TableHead className="hidden px-3 py-2 font-medium text-black/90 dark:text-white/90 lg:table-cell">
                Site
              </TableHead>
              <TableHead className="hidden px-3 py-2 font-medium text-black/90 dark:text-white/90 md:table-cell">
                Frequency
              </TableHead>
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">Schedule date</TableHead>
              <TableHead className="px-1 py-2 text-right font-medium text-black/90 dark:text-white/90">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading schedules…
                </TableCell>
              </TableRow>
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No schedules yet.
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
                >
                  <TableCell className="px-3 py-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="truncate text-sm text-foreground" title={schedule.name}>
                        {schedule.name}
                      </div>
                      {schedule.assigned_to ? (
                        <div className="truncate text-xs text-muted-foreground" title={assigneeLabelById.get(schedule.assigned_to) ?? "Assigned"}>
                          {assigneeLabelById.get(schedule.assigned_to) ?? "Assigned"}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden px-3 py-2 text-sm text-muted-foreground lg:table-cell">
                    <span className="block truncate" title={schedule.site_id ? (siteLabelById.get(schedule.site_id) ?? "Unknown site") : "All sites"}>
                      {schedule.site_id
                        ? (siteLabelById.get(schedule.site_id) ?? "Unknown site")
                        : "All sites"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
                    <FrequencyBadge frequency={schedule.frequency} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                    <span className="block truncate" title={formatScheduleWhen(schedule)}>
                      {formatScheduleWhen(schedule)}
                    </span>
                  </TableCell>
                  <TableCell className="px-1 py-2">
                    <ScheduleActionsMenu schedule={schedule} onEdit={onEdit} onDelete={onDelete} onGenerateNow={onGenerateNow} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
