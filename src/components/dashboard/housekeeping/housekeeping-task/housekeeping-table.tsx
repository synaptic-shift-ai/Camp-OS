"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
  UserRound,
} from "lucide-react"

export type HousekeepingTaskRow = {
  id: string
  siteId?: string
  siteName: string
  reservationConfirmationId?: string | null
  checklistId?: string | null
  checklistItemDone?: Array<{ item_id: string; status: "pending" | "completed" }>
  task: string
  description: string | null
  assigneeId?: string | null
  assignee: string | null
  status: "Pending" | "In Progress" | "Done"
  priority: "Low" | "Medium" | "High" | "Urgent"
  startDate?: string
  dueDate?: string
  startDateValue?: string
  dueDateValue?: string
  dueTime: string
  zone?: string
}

type HousekeepingTableProps = {
  rows: HousekeepingTaskRow[]
  loading?: boolean
  emptyMessage?: string
  onView?: (row: HousekeepingTaskRow) => void
  onReassign?: (row: HousekeepingTaskRow) => void
  onComplete?: (row: HousekeepingTaskRow) => void
  onEdit?: (row: HousekeepingTaskRow) => void
  onDelete?: (row: HousekeepingTaskRow) => void
  canEditTask?: boolean
  canDeleteTask?: boolean
}

function StatusPill({ status }: { status: HousekeepingTaskRow["status"] }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border"

  if (status === "Done") {
    return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>Done</span>
  }

  if (status === "In Progress") {
    return <span className={`${base} border-blue-200 bg-blue-50 text-blue-700`}>In Progress</span>
  }

  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>Pending</span>
}

function PriorityPill({ priority }: { priority: HousekeepingTaskRow["priority"] }) {
  if (priority === "Urgent") {
    return (
      <Badge
        variant="secondary"
        className="rounded-full bg-red-100 text-red-800 font-medium normal-case border border-red-300"
      >
        Urgent
      </Badge>
    )
  }

  if (priority === "High") {
    return (
      <Badge
        variant="secondary"
        className="rounded-full bg-red-50 text-red-700 font-medium normal-case border border-red-200"
      >
        High
      </Badge>
    )
  }

  if (priority === "Medium") {
    return (
      <Badge
        variant="secondary"
        className="rounded-full bg-orange-50 text-orange-700 font-medium normal-case border border-orange-200"
      >
        Medium
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className="rounded-full bg-muted/60 text-foreground font-medium normal-case border border-muted-foreground/10"
    >
      Low
    </Badge>
  )
}

function toDisplayTaskId(id: string): string {
  const cleaned = id.replace(/-/g, "")
  const seed = cleaned.slice(0, 8)
  const parsed = Number.parseInt(seed, 16)
  if (!Number.isFinite(parsed)) return "task_000"
  const serial = (parsed % 999) + 1
  return `task_${String(serial).padStart(3, "0")}`
}

type TaskActionsMenuProps = {
  row: HousekeepingTaskRow
  onView?: HousekeepingTableProps["onView"]
  onReassign?: HousekeepingTableProps["onReassign"]
  onComplete?: HousekeepingTableProps["onComplete"]
  onEdit?: HousekeepingTableProps["onEdit"]
  onDelete?: HousekeepingTableProps["onDelete"]
  canEditTask?: boolean
  canDeleteTask?: boolean
}

function TaskActionsMenu({
  row,
  onView,
  onReassign,
  onComplete,
  onEdit,
  onDelete,
  canEditTask = true,
  canDeleteTask = true,
}: TaskActionsMenuProps) {
  return (
    <div
      className="flex items-center justify-end"
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs" aria-label="Task actions" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canEditTask ? (
            <DropdownMenuItem onClick={() => (onReassign ?? onEdit)?.(row)}>
              <UserRound className="mr-2 h-4 w-4" />
              Reassign task
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => onView?.(row)}>
            <Eye className="mr-2 h-4 w-4" />
            View task
          </DropdownMenuItem>
          {row.status !== "Done" && canEditTask ? (
            <DropdownMenuItem onClick={() => (onComplete ?? onEdit)?.(row)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Complete task
            </DropdownMenuItem>
          ) : null}
          {canEditTask || canDeleteTask ? <DropdownMenuSeparator /> : null}
          {canEditTask ? (
            <DropdownMenuItem onClick={() => onEdit?.(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit task
            </DropdownMenuItem>
          ) : null}
          {canDeleteTask ? (
            <DropdownMenuItem
              onClick={() => onDelete?.(row)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete task
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function formatTaskSchedule(row: HousekeepingTaskRow): string {
  if (row.startDate && row.dueDate) {
    return `${row.startDate} – ${row.dueDate}`
  }
  return row.dueDate ?? row.startDate ?? "—"
}

export function HousekeepingTable({
  rows,
  loading = false,
  emptyMessage = "No housekeeping tasks match the selected filters.",
  onView,
  onReassign,
  onComplete,
  onEdit,
  onDelete,
  canEditTask = true,
  canDeleteTask = true,
}: HousekeepingTableProps) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="rounded-md border border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Loading housekeeping tasks...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className={["rounded-md border border-border/80 bg-card/50 p-3", onView ? "cursor-pointer" : false]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onView?.(row)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold leading-tight text-foreground">{row.task}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">{row.siteName}</span>
                    <PriorityPill priority={row.priority} />
                  </div>
                </div>
                <TaskActionsMenu
                  row={row}
                  onView={onView}
                  onReassign={onReassign}
                  onComplete={onComplete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  canEditTask={canEditTask}
                  canDeleteTask={canDeleteTask}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {toDisplayTaskId(row.id)}
                </p>
                <StatusPill status={row.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{formatTaskSchedule(row)}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <UserRound className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{row.assignee ?? "Unassigned"}</span>
                </span>
              </div>
              {row.description?.trim() ? (
                <p className="mt-2 line-clamp-2 text-sm leading-snug text-muted-foreground">{row.description.trim()}</p>
              ) : null}
              {/* Quick action buttons for mobile — 44px min touch target */}
              {row.status !== "Done" && canEditTask && (onComplete || onReassign) ? (
                <div
                  className="mt-3 flex gap-2 border-t border-border/70 pt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.status === "Pending" && onReassign ? (
                    <button
                      type="button"
                      onClick={() => onReassign(row)}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4" />
                      Start
                    </button>
                  ) : null}
                  {onComplete ? (
                    <button
                      type="button"
                      onClick={() => onComplete(row)}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto border border-border/80 bg-card/50 md:block">
      <Table className="min-w-[760px] w-full table-fixed text-xs lg:min-w-0">
        <colgroup>
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[7%]" />
          <col className="w-[6%]" />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Task ID
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Site
            </TableHead>
            <TableHead className="hidden px-3 py-2 text-black/90 dark:text-white/90 font-medium lg:table-cell">
              Reservation ID
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Task Name
            </TableHead>
            <TableHead className="hidden px-3 py-2 text-black/90 dark:text-white/90 font-medium md:table-cell">
              Assignee
            </TableHead>
            <TableHead className="hidden px-3 py-2 text-black/90 dark:text-white/90 font-medium xl:table-cell">
              Start Date
            </TableHead>
            <TableHead className="hidden px-3 py-2 text-black/90 dark:text-white/90 font-medium xl:table-cell">
              Due Date
            </TableHead>
            <TableHead className="hidden px-3 py-2 text-black/90 dark:text-white/90 font-medium md:table-cell">
              Priority
            </TableHead>
            <TableHead className="px-2 py-2 text-black/90 dark:text-white/90 font-medium">
              Status
            </TableHead>
            <TableHead className="px-2 py-2 text-right text-black/90 dark:text-white/90 font-medium">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                Loading housekeeping tasks...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
              >
                <TableCell className="px-3 py-2 text-sm font-medium text-foreground whitespace-nowrap">
                  <span title={row.id}>{toDisplayTaskId(row.id)}</span>
                </TableCell>
                <TableCell className="px-3 py-2 text-sm font-medium text-foreground whitespace-nowrap">
                  <span className="block truncate" title={row.siteName}>
                    {row.siteName}
                  </span>
                </TableCell>
                <TableCell className="hidden px-3 py-2 text-sm text-muted-foreground whitespace-nowrap lg:table-cell">
                  <span className="block truncate" title={row.reservationConfirmationId ?? "—"}>
                    {row.reservationConfirmationId ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div
                    className="max-w-[90px] truncate text-sm text-foreground md:max-w-[120px] lg:max-w-[160px]"
                    title={row.task}
                  >
                    {row.task}
                  </div>
                </TableCell>
                <TableCell className="hidden px-3 py-2 text-sm text-muted-foreground leading-tight md:table-cell">
                  <span className="block truncate" title={row.assignee ?? "Unassigned"}>
                    {row.assignee ?? "Unassigned"}
                  </span>
                </TableCell>
                <TableCell className="hidden px-3 py-2 text-sm text-muted-foreground xl:table-cell">
                  <span
                    className="block w-full max-w-[110px] truncate 2xl:max-w-[160px]"
                    title={row.startDate ?? "—"}
                  >
                    {row.startDate ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="hidden px-3 py-2 text-sm text-muted-foreground xl:table-cell">
                  <span
                    className="block w-full max-w-[110px] truncate 2xl:max-w-[160px]"
                    title={row.dueDate ?? "—"}
                  >
                    {row.dueDate ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="hidden px-3 py-2 md:table-cell">
                  <PriorityPill priority={row.priority} />
                </TableCell>
                <TableCell className="px-2 py-2 whitespace-nowrap">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="px-2 py-2">
                  <TaskActionsMenu
                    row={row}
                    onView={onView}
                    onReassign={onReassign}
                    onComplete={onComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    canEditTask={canEditTask}
                    canDeleteTask={canDeleteTask}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </>
  )
}
