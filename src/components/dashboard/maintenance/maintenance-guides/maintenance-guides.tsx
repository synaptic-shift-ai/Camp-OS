"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  MaintenanceQueries,
  type MaintenanceGuideListItem,
} from "@/lib/dashboard/maintenance/maintenance-queries"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  EditGuideDialog,
  type EditGuideInput,
} from "../maintenance-dialog/edit-guide-dialog"
import { DeleteGuideConfirmationDialog } from "../maintenance-dialog/delete-guide-dialog"
import { GuideDetailsDialog } from "../maintenance-dialog/guide-details-dialog"
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

function countGuideSteps(steps: MaintenanceGuideListItem["steps"]): number {
  return Array.isArray(steps) ? steps.length : 0
}

type GuideActionsMenuProps = {
  row: MaintenanceGuideListItem
  canEditGuide: boolean
  canDeleteGuide: boolean
  onView: (row: MaintenanceGuideListItem) => void
  onEdit: (row: MaintenanceGuideListItem) => void
  onDelete: (row: MaintenanceGuideListItem) => void
}

function GuideActionsMenu({
  row,
  canEditGuide,
  canDeleteGuide,
  onView,
  onEdit,
  onDelete,
}: GuideActionsMenuProps) {
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
            aria-label={`Guide actions for ${row.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onView(row)}>
            <Eye className="mr-2 h-4 w-4" />
            View guide
          </DropdownMenuItem>
          {canEditGuide ? (
            <DropdownMenuItem onClick={() => onEdit(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit guide
            </DropdownMenuItem>
          ) : null}
          {canDeleteGuide ? (
            <DropdownMenuItem
              onClick={() => onDelete(row)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete guide
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

type MaintenanceGuidesPanelProps = {
  propertyId: string
  /** Increment to refetch after creating or updating guides elsewhere. */
  refreshKey?: number
  canEditGuide?: boolean
  canDeleteGuide?: boolean
  onGuideDeleted?: (guideId: string) => void
}

export function MaintenanceGuidesPanel({
  propertyId,
  refreshKey = 0,
  canEditGuide = false,
  canDeleteGuide = false,
  onGuideDeleted,
}: MaintenanceGuidesPanelProps) {
  const { toast } = useToast()
  const [rows, setRows] = useState<MaintenanceGuideListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [guidePendingDelete, setGuidePendingDelete] = useState<MaintenanceGuideListItem | null>(null)
  const [editingGuide, setEditingGuide] = useState<MaintenanceGuideListItem | null>(null)
  const [viewingGuide, setViewingGuide] = useState<MaintenanceGuideListItem | null>(null)
  const [isSavingGuideEdit, setIsSavingGuideEdit] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const supabase = createClient()
      const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
      const list = await queries.listMaintenanceGuides(propertyId)
      setRows(list)
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Something went wrong while loading guides."
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

  const handleSaveGuideEdit = async (input: EditGuideInput) => {
    setIsSavingGuideEdit(true)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/guides/${input.guideId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            description: input.description,
            steps: input.steps.map((step) => ({
              id: step.id,
              label: step.label,
              notes: step.notes,
            })),
          }),
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to update maintenance guide."
        throw new Error(message)
      }
      toast({
        title: "Guide updated",
        description: "Your changes have been saved.",
        variant: "success",
      })
      setEditingGuide(null)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update maintenance guide."
      toast({
        title: "Unable to save",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSavingGuideEdit(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Loading guides…
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
          <p className="text-sm font-medium text-foreground">No guides yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Maintenance guides will appear here once they are added for this property.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <DeleteGuideConfirmationDialog
        open={canDeleteGuide && guidePendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setGuidePendingDelete(null)
        }}
        propertyId={propertyId}
        guide={
          guidePendingDelete
            ? { id: guidePendingDelete.id, name: guidePendingDelete.name }
            : null
        }
        onDeleted={(guideId) => {
          onGuideDeleted?.(guideId)
          void load()
        }}
      />
      <EditGuideDialog
        open={canEditGuide && editingGuide !== null}
        onOpenChange={(next) => {
          if (!next) setEditingGuide(null)
        }}
        guide={editingGuide}
        isSubmitting={isSavingGuideEdit}
        onSubmit={handleSaveGuideEdit}
      />
      <GuideDetailsDialog
        open={viewingGuide !== null}
        onOpenChange={(next) => {
          if (!next) setViewingGuide(null)
        }}
        guide={viewingGuide}
      />
      <div className="space-y-2 md:hidden">
        {pageRows.map((row) => {
          const stepCount = countGuideSteps(row.steps)
          const createdLabel = formatShortDate(row.created_at)
          const description = row.description?.trim() ? row.description.trim() : null
          return (
            <div
              key={row.id}
              className="cursor-pointer rounded-md border border-border/80 bg-card/50 p-3"
              onClick={() => setViewingGuide(row)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold leading-tight text-foreground">{row.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {description ? (
                      <span className="line-clamp-2 break-words">{description}</span>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <GuideActionsMenu
                  row={row}
                  canEditGuide={canEditGuide}
                  canDeleteGuide={canDeleteGuide}
                  onView={setViewingGuide}
                  onEdit={setEditingGuide}
                  onDelete={setGuidePendingDelete}
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
                  {stepCount} {stepCount === 1 ? "step" : "steps"}
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
      <Table className="min-w-[980px] table-fixed text-sm">
        <colgroup>
          <col style={{ width: "24%" }} />
          <col style={{ width: "36%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-emerald-50 dark:bg-emerald-950/30 uppercase">
          <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableHead className="px-4 py-2 text-left font-medium text-black/90 dark:text-white/90">Name</TableHead>
            <TableHead className="px-4 py-2 text-left font-medium text-black/90 dark:text-white/90">
              Description
            </TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-black/90 dark:text-white/90">Steps</TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-black/90 dark:text-white/90">Created</TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-black/90 dark:text-white/90">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row) => {
            const stepCount = countGuideSteps(row.steps)
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
                  <div
                    className="truncate text-sm leading-normal text-muted-foreground"
                    title={row.description?.trim() || "—"}
                  >
                    {row.description?.trim() ? row.description.trim() : "—"}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-right align-middle text-sm tabular-nums text-muted-foreground">
                  {stepCount}
                </TableCell>
                <TableCell className="px-3 py-2 text-right align-middle text-sm text-muted-foreground whitespace-nowrap">
                  {createdLabel}
                </TableCell>
                <TableCell className="px-3 py-2 align-middle">
                  <GuideActionsMenu
                    row={row}
                    canEditGuide={canEditGuide}
                    canDeleteGuide={canDeleteGuide}
                    onView={setViewingGuide}
                    onEdit={setEditingGuide}
                    onDelete={setGuidePendingDelete}
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
            of <span className="font-medium">{total}</span> guides
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
