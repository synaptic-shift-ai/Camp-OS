"use client"

import { useCallback, useEffect, useState } from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/utils"
import { ClipboardList, Pencil, Trash2 } from "lucide-react"

function countChecklistItems(item: PropertyChecklistListItem["item"]): number {
  return parseChecklistTemplateLines(item).length
}

type HousekeepingChecklistPanelProps = {
  propertyId: string
  /** Increment to refetch after creating or updating checklists elsewhere. */
  refreshKey?: number
  canEditChecklist?: boolean
  canDeleteChecklist?: boolean
}

export function HousekeepingChecklistPanel({
  propertyId,
  refreshKey = 0,
  canEditChecklist = false,
  canDeleteChecklist = false,
}: HousekeepingChecklistPanelProps) {
  const { toast } = useToast()
  const [rows, setRows] = useState<PropertyChecklistListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checklistPendingDelete, setChecklistPendingDelete] = useState<PropertyChecklistListItem | null>(null)
  const [editingChecklist, setEditingChecklist] = useState<PropertyChecklistListItem | null>(null)
  const [isSavingChecklistEdit, setIsSavingChecklistEdit] = useState(false)

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
        onDeleted={() => {
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
      <div className="border border-border/80 bg-card/50">
      <Table className="min-w-[1200px] table-fixed text-xs">
        <colgroup>
          <col style={{ width: "24%" }} />
          <col style={{ width: "36%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="px-4 py-2 text-left font-medium text-black/90 dark:text-white/90">Name</TableHead>
            <TableHead className="px-4 py-2 text-left font-medium text-black/90 dark:text-white/90">
              Description
            </TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-black/90 dark:text-white/90">Items</TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-black/90 dark:text-white/90">Created</TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-black/90 dark:text-white/90">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const itemCount = countChecklistItems(row.item)
            const createdLabel = formatShortDate(row.created_at)
            return (
              <TableRow
                key={row.id}
                className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
              >
                <TableCell className="px-3 py-2 align-top">
                  <div className="break-words text-sm font-semibold leading-snug text-foreground">{row.name}</div>
                </TableCell>
                <TableCell className="px-3 py-2 align-top">
                  <div className="break-words text-sm leading-snug text-muted-foreground">
                    {row.description?.trim() ? row.description.trim() : "—"}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-right align-middle text-sm tabular-nums text-muted-foreground">
                  {itemCount}
                </TableCell>
                <TableCell className="px-3 py-2 text-right align-middle text-sm text-muted-foreground whitespace-nowrap">
                  {createdLabel}
                </TableCell>
                <TableCell className="px-3 py-2 align-middle">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={`Edit ${row.name}`}
                      disabled={!canEditChecklist}
                      title={
                        canEditChecklist
                          ? "Edit checklist template"
                          : "You do not have permission to edit checklists"
                      }
                      onClick={() => {
                        if (!canEditChecklist) return
                        setEditingChecklist(row)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${row.name}`}
                      disabled={!canDeleteChecklist}
                      title={
                        canDeleteChecklist ? "Delete checklist" : "You do not have permission to delete checklists"
                      }
                      onClick={() => {
                        if (!canDeleteChecklist) return
                        setChecklistPendingDelete(row)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    </>
  )
}
