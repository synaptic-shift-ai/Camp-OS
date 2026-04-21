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
import { CheckCircle2, Eye, MoreHorizontal, Pencil, Trash2, UserRound } from "lucide-react"

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
    <div className="border border-border/80 bg-card/50">
      <Table className="min-w-[1480px] text-xs">
        <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="w-[140px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Task ID
            </TableHead>
            <TableHead className="w-[140px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Site
            </TableHead>
            <TableHead className="w-[170px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Reservation ID
            </TableHead>
            <TableHead className="w-[170px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Task Name
            </TableHead>
            <TableHead className="w-[170px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Description
            </TableHead>
            <TableHead className="w-[150px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Assignee
            </TableHead>
            <TableHead className="w-[155px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Start Date
            </TableHead>
            <TableHead className="w-[155px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Due Date
            </TableHead>
            <TableHead className="w-[110px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Priority
            </TableHead>
            <TableHead className="w-[120px] px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Status
            </TableHead>
            <TableHead className="w-[90px] px-3 py-2 text-right text-black/90 dark:text-white/90 font-medium">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                Loading housekeeping tasks...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
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
                  {row.siteName}
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                  {row.reservationConfirmationId ?? "—"}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="space-y-0.5">
                    <div className="text-sm text-foreground">{row.task}</div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                  <div
                    className="max-w-[220px] truncate whitespace-nowrap"
                    title={row.description?.trim() || "—"}
                  >
                    {row.description?.trim() || "—"}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground leading-tight">
                  {row.assignee ?? "Unassigned"}
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                  {row.startDate ?? "—"}
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                  {row.dueDate ?? "—"}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <PriorityPill priority={row.priority} />
                </TableCell>
                <TableCell className="px-3 py-2 whitespace-nowrap">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="flex items-center justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-label="Task actions"
                          className="h-8 w-8 p-0"
                        >
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
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
