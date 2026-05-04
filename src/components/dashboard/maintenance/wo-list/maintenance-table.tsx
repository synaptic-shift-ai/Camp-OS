"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { MoreHorizontal } from "lucide-react"

export type MaintenanceTaskRow = {
  id: string
  woNumber?: string | null
  siteId?: string
  siteName: string
  siteTypeLabel?: string
  task: string
  description?: string | null
  assigneeId?: string | null
  assignee: string | null
  status: "Open" | "In Progress" | "In Progress (Vendor)" | "On Hold" | "Completed" | "Cancelled"
  priority: "Low" | "Medium" | "High" | "Emergency"
  category?: string
  source?: "Guest" | "Housekeeping" | "Staff" | "PM" | "Checkout"
  estimatedLaborCost?: number | null
  estimatedPartsCost?: number | null
  isSuspectedDamage?: boolean
  vendorId?: string | null
  sla?: number | null
}

type MaintenanceTableProps = {
  rows: MaintenanceTaskRow[]
  loading?: boolean
  emptyMessage?: string
  onView?: (row: MaintenanceTaskRow) => void
  onEdit?: (row: MaintenanceTaskRow) => void
  onDelete?: (row: MaintenanceTaskRow) => void
  canEditTask?: boolean
  canDeleteTask?: boolean
  canViewCosts?: boolean
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

  if (status === "In Progress (Vendor)") {
    return (
      <span className={`${base} border-purple-200 bg-purple-50 text-purple-700`}>In Progress (Vendor)</span>
    )
  }

  if (status === "On Hold") {
    return (
      <span className={`${base} border-amber-300 bg-amber-50 text-amber-700`}>On Hold</span>
    )
  }

  if (status === "Cancelled") {
    return (
      <span className={`${base} border-gray-200 bg-gray-50 text-gray-500`}>Cancelled</span>
    )
  }

  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>Open</span>
}

function PriorityPill({ priority }: { priority: MaintenanceTaskRow["priority"] }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border"

  if (priority === "Emergency") {
    return <span className={`${base} border-red-200 bg-red-50 text-red-700`}>Emergency</span>
  }

  if (priority === "High") {
    return <span className={`${base} border-orange-200 bg-orange-50 text-orange-700`}>High</span>
  }

  if (priority === "Medium") {
    return <span className={`${base} border-blue-200 bg-blue-50 text-blue-700`}>Medium</span>
  }

  return <span className={`${base} border-zinc-200 bg-zinc-50 text-zinc-700`}>Low</span>
}

function formatWorkOrderDisplayId(row: MaintenanceTaskRow, _fallbackIndex: number): string {
  if (row.woNumber) return row.woNumber
  return `WO-${row.id.slice(0, 4).toUpperCase()}`
}

function formatSlaHours(sla: number | null | undefined): string {
  if (sla == null || !Number.isFinite(sla) || sla <= 0) return "—"
  return `${sla}h`
}

type TaskActionsMenuProps = {
  row: MaintenanceTaskRow
  onView?: MaintenanceTableProps["onView"]
  onEdit?: MaintenanceTableProps["onEdit"]
  onDelete?: MaintenanceTableProps["onDelete"]
  canEditTask?: boolean
  canDeleteTask?: boolean
}

function TaskActionsMenu({
  row,
  onView,
  onEdit,
  onDelete,
  canEditTask = true,
  canDeleteTask = true,
}: TaskActionsMenuProps) {
  return (
    <div className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs" aria-label="Task actions" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onView?.(row)}>View task</DropdownMenuItem>
          {(canEditTask || canDeleteTask) && <DropdownMenuSeparator />}
          {canEditTask ? (
            <DropdownMenuItem onClick={() => onEdit?.(row)}>Edit task</DropdownMenuItem>
          ) : null}
          {canDeleteTask ? (
            <DropdownMenuItem
              onClick={() => onDelete?.(row)}
              className="text-red-600 focus:text-red-600"
            >
              Delete task
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function MaintenanceTable({
  rows,
  loading = false,
  emptyMessage = "No maintenance tasks match the selected filters.",
  onView,
  onEdit,
  onDelete,
  canEditTask = true,
  canDeleteTask = true,
  canViewCosts = false,
}: MaintenanceTableProps) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="rounded-md border border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Loading maintenance tasks...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          rows.map((row, index) => (
            <div key={row.id} className="rounded-md border border-border/80 bg-card/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold leading-tight text-foreground" title={row.task}>
                    {row.task}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground" title={row.siteName}>
                    {row.siteTypeLabel ? `${row.siteName} · ${row.siteTypeLabel}` : row.siteName}
                  </p>
                </div>
                <TaskActionsMenu
                  row={row}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  canEditTask={canEditTask}
                  canDeleteTask={canDeleteTask}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {formatWorkOrderDisplayId(row, index + 1)}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate" title={row.category ?? "Manual"}>
                    {row.category ?? "Manual"}
                  </span>
                  <span aria-hidden>•</span>
                  <span className="whitespace-nowrap" title={formatSlaHours(row.sla)}>
                    SLA {formatSlaHours(row.sla)}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/70 pt-2 text-xs">
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground">Priority</p>
                  <div className="mt-1">
                    <PriorityPill priority={row.priority} />
                  </div>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusPill status={row.status} />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto border border-border/80 bg-card/50 md:block">
      <Table className="min-w-[980px] w-full table-fixed text-xs lg:min-w-0">
        <colgroup>
          <col className="w-[9%]" />
          <col className="w-[18%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[15%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[7%]" />
          <col className="w-[4%]" />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              ID
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Issue & Site
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Category
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Source
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              SLA
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Cost (Estimated / Actual)
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Assignee
            </TableHead>
            <TableHead className="px-3 py-2 text-black/90 dark:text-white/90 font-medium">
              Priority
            </TableHead>
            <TableHead className="px-2 py-2 text-black/90 dark:text-white/90 font-medium">
              Status
            </TableHead>
            <TableHead className="px-1 py-2 text-right text-black/90 dark:text-white/90 font-medium">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                Loading maintenance tasks...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow
                key={row.id}
                className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
              >
                <TableCell className="px-3 py-2 text-sm font-medium text-foreground whitespace-nowrap">
                  <span title={formatWorkOrderDisplayId(row, index + 1)}>
                    {formatWorkOrderDisplayId(row, index + 1)}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="truncate text-sm text-foreground" title={row.task}>
                      {row.task}
                    </div>
                    <div className="truncate text-xs text-muted-foreground" title={row.siteName}>
                      {row.siteTypeLabel ? `${row.siteName} · ${row.siteTypeLabel}` : row.siteName}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                  <span className="block truncate" title={row.category ?? "Uncategorized"}>
                    {row.category ?? "Uncategorized"}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                  <span className="block truncate" title={row.source ?? "Manual"}>
                    {row.source ?? "Manual"}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                  <span className="block truncate" title={formatSlaHours(row.sla)}>
                    {formatSlaHours(row.sla)}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                  {canViewCosts && ((row.estimatedLaborCost ?? 0) + (row.estimatedPartsCost ?? 0)) > 0 ? (
                    <span className="block truncate" title={`$${((row.estimatedLaborCost ?? 0) + (row.estimatedPartsCost ?? 0)).toFixed(2)}`}>
                      ${((row.estimatedLaborCost ?? 0) + (row.estimatedPartsCost ?? 0)).toFixed(2)}
                    </span>
                  ) : (
                    <span className="block truncate" title="—">
                      —
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                  <span className="block truncate" title={row.assignee ?? "Unassigned"}>
                    {row.assignee ?? "Unassigned"}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 whitespace-nowrap">
                  <PriorityPill priority={row.priority} />
                </TableCell>
                <TableCell className="px-2 py-2 whitespace-nowrap">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="px-1 py-2">
                  <TaskActionsMenu
                    row={row}
                    onView={onView}
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
