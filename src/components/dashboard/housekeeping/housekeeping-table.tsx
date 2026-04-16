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
import { Eye, Pencil, Trash2 } from "lucide-react"

export type HousekeepingTaskRow = {
  id: string
  siteId?: string
  siteName: string
  task: string
  description: string | null
  assigneeId?: string | null
  assignee: string | null
  status: "Pending" | "In Progress" | "Done"
  priority: "Low" | "Medium" | "High"
  dueTime: string
  zone?: string
}

type HousekeepingTableProps = {
  rows: HousekeepingTaskRow[]
  loading?: boolean
  emptyMessage?: string
  onView?: (row: HousekeepingTaskRow) => void
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

export function HousekeepingTable({
  rows,
  loading = false,
  emptyMessage = "No housekeeping tasks match the selected filters.",
  onView,
  onEdit,
  onDelete,
  canEditTask = true,
  canDeleteTask = true,
}: HousekeepingTableProps) {
  return (
    <div className="border border-border/80 bg-card/50">
      <Table className="text-xs">
        <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="w-[160px] py-1.5 text-black/90 dark:text-white/90 font-medium">
              Site
            </TableHead>
            <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
              Task
            </TableHead>
            <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
              Description
            </TableHead>
            <TableHead className="w-[180px] py-1.5 text-black/90 dark:text-white/90 font-medium">
              Asignee
            </TableHead>
            <TableHead className="w-[140px] py-1.5 text-black/90 dark:text-white/90 font-medium">
              Status
            </TableHead>
            <TableHead className="w-[140px] py-1.5 text-right text-black/90 dark:text-white/90 font-medium">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Loading housekeeping tasks...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
              >
                <TableCell className="py-1.5 text-sm font-medium text-foreground whitespace-nowrap">
                  {row.siteName}
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="space-y-0.5">
                    <div className="text-sm text-foreground">{row.task}</div>
                  </div>
                </TableCell>
                <TableCell className="py-1.5 text-sm text-muted-foreground">
                  {row.description?.trim() || "—"}
                </TableCell>
                <TableCell className="py-1.5 text-sm text-muted-foreground">
                  {row.assignee ?? "Unassigned"}
                </TableCell>
                <TableCell className="py-1.5">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label="View task"
                      className="h-8 w-8 p-0"
                      onClick={() => onView?.(row)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEditTask && (
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label="Edit task"
                        className="h-8 w-8 p-0"
                        onClick={() => onEdit?.(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteTask && (
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label="Delete task"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => onDelete?.(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
