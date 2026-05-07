"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  HousekeepingQueries,
  parseChecklistTemplateLines,
  type PropertyChecklistListItem,
} from "@/lib/dashboard/housekeeping/housekeeping-queries"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  EditChecklistDialog,
  type EditChecklistTemplateInput,
} from "../housekeeping-dialog.tsx/edit-checklist-dialog"
import { DeleteChecklistConfirmationDialog } from "../housekeeping-dialog.tsx/delete-checklist-confirmation-dialog"
import { ChecklistDetailsDialog } from "../housekeeping-dialog.tsx/checklist-details-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/utils"
import { CalendarDays, ClipboardList, Eye, ListChecks, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"

function countChecklistItems(item: PropertyChecklistListItem["item"]): number {
  return parseChecklistTemplateLines(item).length
}

type ChecklistActionsMenuProps = {
  row: PropertyChecklistListItem
  canEditChecklist: boolean
  canDeleteChecklist: boolean
  onView: (row: PropertyChecklistListItem) => void
  onEdit: (row: PropertyChecklistListItem) => void
  onDelete: (row: PropertyChecklistListItem) => void
}

function ChecklistActionsMenu({
  row,
  canEditChecklist,
  canDeleteChecklist,
  onView,
  onEdit,
  onDelete,
}: ChecklistActionsMenuProps) {
  return (
    <div
      className="flex items-center justify-end"
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            aria-label={`Checklist actions for ${row.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onView(row)}>
            <Eye className="mr-2 h-4 w-4" />
            View checklist
          </DropdownMenuItem>
          {canEditChecklist ? (
            <DropdownMenuItem onClick={() => onEdit(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit checklist
            </DropdownMenuItem>
          ) : null}
          {canDeleteChecklist ? (
            <DropdownMenuItem
              onClick={() => onDelete(row)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete checklist
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

type HousekeepingChecklistPanelProps = {
  propertyId: string
  /** Increment to refetch after creating or updating checklists elsewhere. */
  refreshKey?: number
  canEditChecklist?: boolean
  canDeleteChecklist?: boolean
  onChecklistDeleted?: (checklistId: string) => void
}

export function HousekeepingChecklistPanel({
  propertyId,
  refreshKey = 0,
  canEditChecklist = false,
  canDeleteChecklist = false,
  onChecklistDeleted,
}: HousekeepingChecklistPanelProps) {
  const { toast } = useToast()
  const [rows, setRows] = useState<PropertyChecklistListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checklistPendingDelete, setChecklistPendingDelete] = useState<PropertyChecklistListItem | null>(null)
  const [editingChecklist, setEditingChecklist] = useState<PropertyChecklistListItem | null>(null)
  const [viewingChecklist, setViewingChecklist] = useState<PropertyChecklistListItem | null>(null)
  const [isSavingChecklistEdit, setIsSavingChecklistEdit] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const supabase = createClient()
      const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
      const list = await queries.listPropertyChecklists(propertyId)
      setRows(list)
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Something went wrong while loading checklists."
      setErrorMessage(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageRows = useMemo(() => {
    const start = (page - 1) * perPage
    return rows.slice(start, start + perPage)
  }, [rows, page, perPage])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [rows, totalPages])

  const startIndex = total === 0 ? 0 : (page - 1) * perPage + 1
  const endIndex = total === 0 ? 0 : Math.min(page * perPage, total)

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(next, totalPages))
      setPage(clamped)
    },
    [totalPages],
  )

  const handleSaveChecklistEdit = async (input: EditChecklistTemplateInput) => {
    setIsSavingChecklistEdit(true)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/housekeeping/checklists/${input.checklistId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            description: input.description,
            items: input.items.map((row) => ({
              id: row.id,
              label: row.label,
              notes: row.notes,
            })),
          }),
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to update checklist template."
        throw new Error(message)
      }
      toast({
        title: "Checklist updated",
        description: "Your changes have been saved.",
        variant: "success",
      })
      setEditingChecklist(null)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update checklist template."
      toast({
        title: "Unable to save",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSavingChecklistEdit(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Loading checklists…
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        {errorMessage}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/80 bg-card px-6 py-14 text-center">
        <ClipboardList className="h-10 w-10 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No checklists yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Property checklists will appear here once they are added for this property.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <DeleteChecklistConfirmationDialog
        open={canDeleteChecklist && checklistPendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setChecklistPendingDelete(null)
        }}
        propertyId={propertyId}
        checklist={
          checklistPendingDelete
            ? { id: checklistPendingDelete.id, name: checklistPendingDelete.name }
            : null
        }
        onDeleted={(checklistId) => {
          onChecklistDeleted?.(checklistId)
          void load()
        }}
      />
      <EditChecklistDialog
        open={canEditChecklist && editingChecklist !== null}
        onOpenChange={(next) => {
          if (!next) setEditingChecklist(null)
        }}
        checklist={editingChecklist}
        isSubmitting={isSavingChecklistEdit}
        onSubmit={handleSaveChecklistEdit}
      />
      <ChecklistDetailsDialog
        open={viewingChecklist !== null}
        onOpenChange={(next) => {
          if (!next) setViewingChecklist(null)
        }}
        checklist={viewingChecklist}
      />
      <div className="space-y-2 md:hidden">
        {pageRows.map((row) => {
          const itemCount = countChecklistItems(row.item)
          const createdLabel = formatShortDate(row.created_at)
          const description = row.description?.trim() ? row.description.trim() : null
          return (
            <div
              key={row.id}
              className="cursor-pointer rounded-md border border-border/80 bg-card/50 p-3"
              onClick={() => setViewingChecklist(row)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold leading-tight text-foreground">{row.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {description ? (
                      <span className="line-clamp-2 break-words" title={description}>
                        {description}
                      </span>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <ChecklistActionsMenu
                  row={row}
                  canEditChecklist={canEditChecklist}
                  canDeleteChecklist={canDeleteChecklist}
                  onView={setViewingChecklist}
                  onEdit={setEditingChecklist}
                  onDelete={setChecklistPendingDelete}
                />
              </div>
              <div className="mt-2">
                <p
                  className="truncate font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
                  title={row.id}
                >
                  {row.id}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5 shrink-0" />
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {createdLabel}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden border border-border/80 bg-card/50 md:block md:overflow-x-auto">
      <Table className="min-w-[720px] w-full table-fixed text-xs">
        <colgroup>
          <col style={{ width: "18%" }} />
          <col style={{ width: "54%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="px-3 py-2 text-left font-medium text-black/90 dark:text-white/90">Name</TableHead>
            <TableHead className="px-3 py-2 text-left font-medium text-black/90 dark:text-white/90">
              Description
            </TableHead>
            <TableHead className="px-2 py-2 text-right font-medium whitespace-nowrap text-black/90 dark:text-white/90">
              Items
            </TableHead>
            <TableHead className="px-2 py-2 text-right font-medium whitespace-nowrap text-black/90 dark:text-white/90">
              Created
            </TableHead>
            <TableHead className="px-2 py-2 text-right font-medium whitespace-nowrap text-black/90 dark:text-white/90">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row) => {
            const itemCount = countChecklistItems(row.item)
            const createdLabel = formatShortDate(row.created_at)
            const description = row.description?.trim() ? row.description.trim() : null
            return (
              <TableRow
                key={row.id}
                className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
              >
                <TableCell className="max-w-0 px-3 py-2 align-top">
                  <div className="break-words text-sm font-semibold leading-snug text-foreground">{row.name}</div>
                </TableCell>
                <TableCell className="max-w-0 px-3 py-2 align-top">
                  {description ? (
                    <div
                      className="line-clamp-2 break-words text-sm leading-snug text-muted-foreground"
                      title={description}
                    >
                      {description}
                    </div>
                  ) : (
                    <div className="text-sm leading-snug text-muted-foreground">—</div>
                  )}
                </TableCell>
                <TableCell className="px-2 py-2 text-right align-middle text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                  {itemCount}
                </TableCell>
                <TableCell className="px-2 py-2 text-right align-middle text-sm text-muted-foreground whitespace-nowrap">
                  {createdLabel}
                </TableCell>
                <TableCell className="px-2 py-2 align-middle">
                  <ChecklistActionsMenu
                    row={row}
                    canEditChecklist={canEditChecklist}
                    canDeleteChecklist={canDeleteChecklist}
                    onView={setViewingChecklist}
                    onEdit={setEditingChecklist}
                    onDelete={setChecklistPendingDelete}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <div>
            Showing{" "}
            <span className="font-medium">
              {startIndex}–{endIndex}
            </span>{" "}
            of <span className="font-medium">{total}</span> checklists
          </div>
          <PageSizeSelector
            value={perPage}
            onChange={(next) => {
              setPerPage(next)
              setPage(1)
            }}
            disabled={loading}
          />
        </div>
        <div className="flex w-full justify-center sm:w-auto sm:justify-end">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={goToPage}
            disabled={loading}
            windowSize={2}
          />
        </div>
      </div>
    </>
  )
}
