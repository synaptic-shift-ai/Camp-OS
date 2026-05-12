"use client"

import { useEffect, useState } from "react"
import { CalendarCheck2, Loader2, MoreHorizontal, Zap } from "lucide-react"
import { format, isBefore, startOfDay } from "date-fns"
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
import { toast } from "sonner"

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
  // Enriched fields from enhanced listSchedules query
  last_completed_at: string | null
  next_due_date: string | null
  total_generated: number
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

/** Format next due date with overdue styling */
function NextDueCell({ nextDueDate }: { nextDueDate: string | null }) {
  if (!nextDueDate) {
    return <span className="text-muted-foreground">—</span>
  }

  const dueDate = startOfDay(new Date(nextDueDate))
  const today = startOfDay(new Date())
  const isOverdue = isBefore(dueDate, today)
  const isDueToday = dueDate.getTime() === today.getTime()

  if (isOverdue) {
    return (
      <span className="font-medium text-red-600 dark:text-red-400">
        Overdue!
      </span>
    )
  }

  if (isDueToday) {
    return (
      <span className="font-medium text-amber-600 dark:text-amber-400">
        Due today
      </span>
    )
  }

  return <span>{format(new Date(nextDueDate), "MMM d, yyyy")}</span>
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
    <div
      className="cursor-pointer rounded-md border border-border/80 bg-card/50 p-3 hover:bg-muted/50"
      onClick={() => onEdit?.(schedule)}
    >
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
        <div onClick={(e) => e.stopPropagation()}>
          <ScheduleActionsMenu schedule={schedule} onEdit={onEdit} onDelete={onDelete} onGenerateNow={onGenerateNow} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-xs">
        <div>
          <span className="text-muted-foreground">Frequency</span>
          <div className="mt-0.5">
            <FrequencyBadge frequency={schedule.frequency} />
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Schedule</span>
          <p className="mt-0.5 text-foreground">{formatScheduleWhen(schedule)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Last Completed</span>
          <p className="mt-0.5 text-foreground">
            {schedule.last_completed_at
              ? format(new Date(schedule.last_completed_at), "MMM d, yyyy")
              : "—"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Next Due</span>
          <p className="mt-0.5 text-foreground">
            <NextDueCell nextDueDate={schedule.next_due_date} />
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Generated</span>
          <p className="mt-0.5 text-foreground">{schedule.total_generated}</p>
        </div>
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
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)

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

  /** Determine if a schedule is overdue (next_due_date is in the past) */
  const isOverdue = (schedule: ScheduleRow): boolean => {
    if (!schedule.next_due_date) return false
    const dueDate = startOfDay(new Date(schedule.next_due_date))
    return isBefore(dueDate, startOfDay(new Date()))
  }

  /** Generate work orders for all overdue schedules */
  const handleGenerateAllDue = async () => {
    const overdueSchedules = schedules.filter(isOverdue)
    if (overdueSchedules.length === 0) {
      toast.info("No overdue schedules to generate")
      return
    }

    setIsGeneratingAll(true)
    let successCount = 0
    let failCount = 0

    for (const schedule of overdueSchedules) {
      try {
        const response = await fetch(
          `/api/v1/properties/${propertyId}/maintenance/schedules/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduleId: schedule.id }),
          },
        )
        const payload = await response.json()

        if (response.ok && payload?.success) {
          successCount++
        } else {
          failCount++
          console.warn("[SchedulesList] Generate failed for schedule", {
            id: schedule.id,
            error: payload?.error?.message,
          })
        }
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      toast.success(`Generated ${successCount} work order${successCount > 1 ? "s" : ""}`)
    }
    if (failCount > 0) {
      toast.error(`Failed to generate ${failCount} work order${failCount > 1 ? "s" : ""}`)
    }

    setIsGeneratingAll(false)

    // Trigger a refresh if any were generated
    if (successCount > 0 && onGenerateNow) {
      // Reload the list
      const response = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/schedules`,
      )
      const payload = await response.json()
      if (payload?.success) {
        const list = payload.data?.schedules as ScheduleRow[] | undefined
        if (Array.isArray(list)) {
          setSchedules(list)
        }
      }
    }
  }

  const overdueCount = schedules.filter(isOverdue).length
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
      {/* Generate All Due button */}
      {schedules.length > 0 && overdueCount > 0 && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleGenerateAllDue()}
            disabled={isGeneratingAll}
          >
            {isGeneratingAll ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="mr-1.5 h-3.5 w-3.5" />
            )}
            Generate All Due ({overdueCount})
          </Button>
          {isGeneratingAll && (
            <span className="text-xs text-muted-foreground">
              Generating work orders…
            </span>
          )}
        </div>
      )}

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
        <Table className="w-full min-w-[960px] table-fixed text-xs lg:min-w-0">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
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
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">Last Completed</TableHead>
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">Next Due</TableHead>
              <TableHead className="px-3 py-2 text-right font-medium text-black/90 dark:text-white/90">Generated</TableHead>
              <TableHead className="px-1 py-2 text-right font-medium text-black/90 dark:text-white/90">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Loading schedules…
                </TableCell>
              </TableRow>
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No schedules yet.
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  className="cursor-pointer border-border/80 hover:bg-muted/50 data-[state=selected]:bg-muted/30"
                  onClick={() => onEdit?.(schedule)}
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
                    {schedule.last_completed_at
                      ? format(new Date(schedule.last_completed_at), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm">
                    <NextDueCell nextDueDate={schedule.next_due_date} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right text-sm text-muted-foreground">
                    {schedule.total_generated}
                  </TableCell>
                  <TableCell className="px-1 py-2" onClick={(e) => e.stopPropagation()}>
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
