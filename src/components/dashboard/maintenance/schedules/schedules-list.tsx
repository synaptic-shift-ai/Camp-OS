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
import { Skeleton } from "@/components/ui/skeleton"

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
  showGenerateNow,
  onEdit,
  onDelete,
  onGenerateNow,
}: {
  schedule: ScheduleRow
  showGenerateNow: boolean
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
            Generate Now
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

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i} className="border-border/80 hover:bg-transparent">
          <TableCell className="px-3 py-2">
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell className="hidden px-3 py-2 lg:table-cell">
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="hidden px-3 py-2 md:table-cell">
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell className="px-3 py-2">
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="px-1 py-2">
            <Skeleton className="ml-auto h-8 w-8 rounded" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

function MobileSkeletonCards() {
  return (
    <div className="space-y-2 md:hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-border/80 bg-card/50 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-border/70 pt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
      <CalendarCheck2 className="h-10 w-10" aria-hidden />
      <p className="text-sm font-medium">No schedules yet</p>
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
        <ScheduleActionsMenu
          schedule={schedule}
          showGenerateNow={schedule.schedule_date != null}
          onEdit={onEdit}
          onDelete={onDelete}
          onGenerateNow={onGenerateNow}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-2">
        <FrequencyBadge frequency={schedule.frequency} />
        <p className="text-xs text-muted-foreground">
          {schedule.schedule_date
            ? format(new Date(schedule.schedule_date), "MMM d, yyyy")
            : "Not set"}
        </p>
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
      <section className="space-y-4 rounded-2xl">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-2xl">
      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {loading ? (
          <MobileSkeletonCards />
        ) : schedules.length === 0 ? (
          <EmptyState />
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

      {/* Desktop table */}
      <div className="hidden overflow-x-auto border border-border/80 bg-card/50 md:block">
        <Table className="w-full min-w-[680px] table-fixed text-xs lg:min-w-0">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[20%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
            <col className="w-[6%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-[#1F6B45] uppercase dark:bg-[#1F6B45]/80">
            <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
              <TableHead className="px-3 py-2 font-medium text-white/95">Name</TableHead>
              <TableHead className="hidden px-3 py-2 font-medium text-white/95 lg:table-cell">
                Site
              </TableHead>
              <TableHead className="hidden px-3 py-2 font-medium text-white/95 md:table-cell">
                Frequency
              </TableHead>
              <TableHead className="px-3 py-2 font-medium text-white/95">Schedule Date</TableHead>
              <TableHead className="px-1 py-2 text-right font-medium text-white/95">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  <EmptyState />
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
                >
                  <TableCell className="px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground" title={schedule.name}>
                        {schedule.name}
                      </p>
                      {schedule.assigned_to && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {assigneeLabelById.get(schedule.assigned_to) ?? "Assigned"}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap px-3 py-2 text-sm text-muted-foreground lg:table-cell">
                    {schedule.site_id
                      ? (siteLabelById.get(schedule.site_id) ?? "Unknown site")
                      : "All sites"}
                  </TableCell>
                  <TableCell className="hidden px-3 py-2 md:table-cell">
                    <FrequencyBadge frequency={schedule.frequency} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                    {schedule.schedule_date
                      ? format(new Date(schedule.schedule_date), "MMM d, yyyy")
                      : "Not set"}
                  </TableCell>
                  <TableCell className="px-1 py-2">
                    <ScheduleActionsMenu
                      schedule={schedule}
                      showGenerateNow={schedule.schedule_date != null}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onGenerateNow={onGenerateNow}
                    />
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
