"use client"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Eye, Pencil, Trash2 } from "lucide-react"

export type MaintenanceTaskRow = {
  id: string
  siteName: string
  task: string
  assignee: string | null
  status: "Open" | "In Progress" | "Completed"
  priority: "Low" | "Medium" | "High"
  category?: string
}

type MaintenanceTableProps = {
  rows: MaintenanceTaskRow[]
  loading?: boolean
  emptyMessage?: string
  onView?: (row: MaintenanceTaskRow) => void
  onEdit?: (row: MaintenanceTaskRow) => void
  onDelete?: (row: MaintenanceTaskRow) => void
}

function StatusPill({ status }: { status: MaintenanceTaskRow["status"] }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border"

  if (status === "Completed") {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>
        Completed
      </span>
    )
  }

  if (status === "In Progress") {
    return (
      <span className={`${base} border-blue-200 bg-blue-50 text-blue-700`}>In Progress</span>
    )
  }

  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>Open</span>
}

export function MaintenanceTable({
  rows,
  loading = false,
  emptyMessage = "No maintenance tasks match the selected filters.",
  onView,
  onEdit,
  onDelete,
}: MaintenanceTableProps) {
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
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Loading maintenance tasks...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                    {row.category ? (
                      <div className="text-xs text-muted-foreground">{row.category}</div>
                    ) : null}
                  </div>
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
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label="Edit task"
                      className="h-8 w-8 p-0"
                      onClick={() => onEdit?.(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label="Delete task"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      onClick={() => onDelete?.(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
