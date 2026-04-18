"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Eye, Pencil, Trash2, Copy } from "lucide-react"
import type { AutomationRow } from "@/lib/automations/types"
import { PHASE_COLORS } from "@/lib/automations/templates"
import { cn } from "@/lib/utils"

type AutomationsTableProps = {
  rows: AutomationRow[]
  loading?: boolean
  emptyMessage?: string
  onView?: (row: AutomationRow) => void
  onEdit?: (row: AutomationRow) => void
  onDuplicate?: (row: AutomationRow) => void
  onDelete?: (row: AutomationRow) => void
  onToggleActive?: (row: AutomationRow) => void
  canManage?: boolean
}

function PhasePill({ phase }: { phase: string }) {
  const colorClass = PHASE_COLORS[phase as keyof typeof PHASE_COLORS] ?? "bg-gray-500/10 text-gray-600 border-gray-500/20"
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-3 py-1 text-xs font-medium", colorClass)}
    >
      {phase.charAt(0) + phase.slice(1).toLowerCase()}
    </Badge>
  )
}

function StatusPill({ isActive }: { isActive: boolean }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border"
  if (isActive) {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400`}>
        Active
      </span>
    )
  }
  return (
    <span className={`${base} border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-500`}>
      Inactive
    </span>
  )
}


function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function AutomationsTable({
  rows,
  loading = false,
  emptyMessage = "No automations yet. Create one or use a template.",
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleActive: _onToggleActive,
  canManage = true,
}: AutomationsTableProps) {
  return (
    <div className="border border-border/80 bg-card/50">
      <Table className="text-xs">
        <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
              Name
            </TableHead>
            <TableHead className="w-[60px] py-1.5 text-center text-black/90 dark:text-white/90 font-medium">
              Order
            </TableHead>
            <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
              Phase
            </TableHead>
            <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
              Trigger
            </TableHead>
            <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
              Status
            </TableHead>
            <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
              Terminal
            </TableHead>
            <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
              Created
            </TableHead>
            <TableHead className="w-[140px] py-1.5 text-right text-black/90 dark:text-white/90 font-medium">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                Loading automations...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
              >
                <TableCell className="py-1.5">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-foreground">{row.name}</div>
                    {row.description ? (
                      <div className="text-xs text-muted-foreground">{row.description}</div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="py-1.5 text-center text-muted-foreground">
                  {row.sort_order}
                </TableCell>
                <TableCell className="py-1.5">
                  <PhasePill phase={row.phase} />
                </TableCell>
                <TableCell className="py-1.5 text-sm text-muted-foreground whitespace-nowrap">
                  <span className="font-mono text-xs">{row.trigger_type}</span>
                </TableCell>
                <TableCell className="py-1.5">
                  <StatusPill isActive={row.is_active} />
                </TableCell>
                <TableCell className="py-1.5 text-sm text-muted-foreground">
                  {row.is_terminal ? "Yes" : "—"}
                </TableCell>
                <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(row.created_at)}
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label="View automation"
                      className="h-8 w-8 p-0"
                      onClick={() => onView?.(row)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-label="Edit automation"
                          className="h-8 w-8 p-0"
                          onClick={() => onEdit?.(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-label="Duplicate automation"
                          className="h-8 w-8 p-0"
                          onClick={() => onDuplicate?.(row)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-label="Delete automation"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => onDelete?.(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
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
