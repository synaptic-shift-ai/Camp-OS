"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { HousekeepingChecklistPanel } from "./housekeeping-checklist"
import { HousekeepingFilter, type HousekeepingFilterValue } from "./housekeeping-filter"
import { HousekeepingPageHeader } from "./housekeeping-page-header"
import { HousekeepingTable, type HousekeepingTaskRow } from "./housekeeping-table"
import {
  HousekeepingViewSwitcher,
  type HousekeepingViewMode,
} from "./housekeeping-view-switcher"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import { useToast } from "@/hooks/use-toast"
import {
  AddTaskDialog,
  type AddHousekeepingTaskInput,
} from "./housekeeping-dialog.tsx/add-task-dialog"
import {
  AddChecklistDialog,
  type AddChecklistTemplateInput,
} from "./housekeeping-dialog.tsx/add-checklist-dialog"
import { EditTaskDialog } from "./housekeeping-dialog.tsx/edit-task-dialog"
import { DeleteTaskConfirmationDialog } from "./housekeeping-dialog.tsx/delete-task-confirmation-dialog"
import { TaskDetailsDialog } from "./housekeeping-dialog.tsx/task-details-dialog"

type HousekeepingPageContentProps = {
  propertyId: string
  propertyName: string
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  canCreateTask: boolean
  canEditTask: boolean
  canDeleteTask: boolean
}

const INITIAL_FILTERS: HousekeepingFilterValue = {
  search: "",
  siteId: "all",
  assigneeId: "all",
  status: "all",
}

function toApiStatus(status: AddHousekeepingTaskInput["status"]): "pending" | "in_progress" | "done" {
  if (status === "In Progress") return "in_progress"
  if (status === "Done") return "done"
  return "pending"
}

function fromApiStatus(status: string): HousekeepingTaskRow["status"] {
  if (status === "in_progress") return "In Progress"
  if (status === "done") return "Done"
  return "Pending"
}

function filterStatusToApi(
  status: HousekeepingFilterValue["status"],
): "pending" | "in_progress" | "done" | null {
  if (status === "all") return null
  if (status === "In Progress") return "in_progress"
  if (status === "Done") return "done"
  return "pending"
}

const FILTER_DEBOUNCE_MS = 400

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

type ApiHousekeepingTask = {
  id: string
  site_id: string
  title: string
  description: string | null
  status: string
  staff_id: string | null
  site: { site_name: string | null; site_number: string | null } | null
}

export function HousekeepingPageContent({
  propertyId,
  propertyName,
  siteOptions,
  assigneeOptions,
  canCreateTask,
  canEditTask,
  canDeleteTask,
}: HousekeepingPageContentProps) {
  const { toast } = useToast()
  const [filters, setFilters] = useState<HousekeepingFilterValue>(INITIAL_FILTERS)
  const debouncedFilters = useDebouncedValue(filters, FILTER_DEBOUNCE_MS)
  const filtersForApi = useMemo(
    () => ({
      siteId: debouncedFilters.siteId,
      assigneeId: debouncedFilters.assigneeId,
      status: debouncedFilters.status,
      search: debouncedFilters.search,
    }),
    [debouncedFilters],
  )
  const assigneeOptionsRef = useRef(assigneeOptions)
  assigneeOptionsRef.current = assigneeOptions
  const assigneeOptionsKey = useMemo(
    () => assigneeOptions.map((option) => `${option.id}:${option.label}`).join("\u001f"),
    [assigneeOptions],
  )

  const filtersApiKey = useMemo(
    () =>
      `${filtersForApi.search}|${filtersForApi.siteId}|${filtersForApi.assigneeId}|${filtersForApi.status}`,
    [filtersForApi],
  )

  const pageRef = useRef(1)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)

  const [loading, setLoading] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isUpdatingTask, setIsUpdatingTask] = useState(false)
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false)
  const [isAddChecklistDialogOpen, setIsAddChecklistDialogOpen] = useState(false)
  const [isSavingChecklist, setIsSavingChecklist] = useState(false)
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0)
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<HousekeepingTaskRow | null>(null)
  const [taskPendingDelete, setTaskPendingDelete] = useState<HousekeepingTaskRow | null>(null)
  const [viewingTask, setViewingTask] = useState<HousekeepingTaskRow | null>(null)
  const [rows, setRows] = useState<HousekeepingTaskRow[]>([])
  const [openTaskCount, setOpenTaskCount] = useState(0)
  const [viewMode, setViewMode] = useState<HousekeepingViewMode>("tasks")

  useEffect(() => {
    pageRef.current = 1
    setPage(1)
  }, [filtersApiKey, perPage])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const search = filtersForApi.search.trim()
      if (search.length > 0) {
        params.set("search", search)
      }
      if (filtersForApi.siteId !== "all") {
        params.set("siteId", filtersForApi.siteId)
      }
      if (filtersForApi.assigneeId !== "all") {
        params.set("assigneeId", filtersForApi.assigneeId)
      }
      const statusParam = filterStatusToApi(filtersForApi.status)
      if (statusParam) {
        params.set("status", statusParam)
      }
      params.set("page", String(pageRef.current))
      params.set("per_page", String(perPage))
      const query = params.toString()
      const response = await fetch(
        `/api/v1/properties/${propertyId}/housekeeping${query ? `?${query}` : ""}`,
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to load housekeeping tasks."
        throw new Error(message)
      }

      const opts = assigneeOptionsRef.current
      const assigneeLabelById = new Map(opts.map((option) => [option.id, option.label]))
      const mappedRows: HousekeepingTaskRow[] = (payload.data?.tasks ?? []).map((task: ApiHousekeepingTask) => ({
        id: task.id,
        siteId: task.site_id,
        siteName: task.site?.site_name?.trim() || task.site?.site_number || "Unknown site",
        task: task.title,
        description: task.description,
        assigneeId: task.staff_id,
        assignee: task.staff_id ? (assigneeLabelById.get(task.staff_id) ?? "Assigned") : null,
        status: fromApiStatus(task.status),
        priority: "Medium",
        dueTime: "TBD",
        zone: "Unassigned",
      }))
      setRows(mappedRows)
      const apiTotal = typeof payload.data?.total === "number" ? payload.data.total : mappedRows.length
      setTotal(apiTotal)
      const totalPages = Math.max(1, Math.ceil(apiTotal / perPage))
      setPage((current) => {
        const next = Math.min(current, totalPages)
        pageRef.current = next
        return next
      })
      const count = payload.data?.openTaskCount
      setOpenTaskCount(typeof count === "number" ? count : mappedRows.filter((row) => row.status !== "Done").length)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load tasks."
      toast({
        title: "Unable to load tasks",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [propertyId, filtersForApi, perPage, toast])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks, assigneeOptionsKey, page])

  const handleRefresh = () => {
    void loadTasks()
  }

  const handleExport = (format: string) => {
    if (format !== "csv") return

    const filename = buildExportFilename("HOUSEKEEPING")
    exportToCsv<HousekeepingTaskRow>(filename, rows, [
      { key: "siteName", header: "Site" },
      { key: "task", header: "Task" },
      {
        key: "description",
        header: "Description",
        accessor: (row) => row.description ?? "—",
      },
      {
        key: "assignee",
        header: "Asignee",
        accessor: (row) => row.assignee ?? "Unassigned",
      },
      { key: "status", header: "Status" },
      { key: "priority", header: "Priority" },
      { key: "dueTime", header: "Due Time" },
      { key: "zone", header: "Zone", accessor: (row) => row.zone ?? "—" },
    ])

    toast({
      title: "Export ready",
      description: "Housekeeping CSV has been downloaded (current page only).",
    })
  }

  const handleSaveChecklistTemplate = async (input: AddChecklistTemplateInput) => {
    setIsSavingChecklist(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/housekeeping/checklists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          items: input.items.map((row) => ({
            label: row.label,
            notes: row.notes,
          })),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to save checklist template."
        throw new Error(message)
      }
      setChecklistRefreshKey((key) => key + 1)
      toast({
        title: "Checklist saved",
        description: "The template has been added to this property.",
      })
    } finally {
      setIsSavingChecklist(false)
    }
  }

  const handleAddTask = async (input: AddHousekeepingTaskInput) => {
    if (!input.siteId) {
      throw new Error("Site is required.")
    }
    setIsCreatingTask(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/housekeeping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId: input.siteId,
          staffId: input.assigneeId ?? null,
          title: input.task,
          description: input.description?.trim() ? input.description.trim() : null,
          status: toApiStatus(input.status),
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to create housekeeping task."
        throw new Error(message)
      }

      await loadTasks()

      toast({
        title: "Task added",
        description: "A new housekeeping task has been added to the table.",
      })
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleOpenEditTask = (row: HousekeepingTaskRow) => {
    setEditingTask(row)
    setIsEditTaskDialogOpen(true)
  }

  const handleViewTask = (row: HousekeepingTaskRow) => {
    setViewingTask(row)
  }

  const handleRequestDeleteTask = (row: HousekeepingTaskRow) => {
    setTaskPendingDelete(row)
  }

  const handleEditTask = async (input: AddHousekeepingTaskInput & { id: string }) => {
    if (!input.siteId) {
      throw new Error("Site is required.")
    }
    const siteId = input.siteId

    setIsUpdatingTask(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/housekeeping/${input.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId,
          staffId: input.assigneeId ?? null,
          title: input.task,
          description: input.description?.trim() ? input.description.trim() : null,
          status: toApiStatus(input.status),
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to update housekeeping task."
        throw new Error(message)
      }

      await loadTasks()

      toast({
        title: "Task updated",
        description: "Housekeeping task details were updated successfully.",
      })
    } finally {
      setIsUpdatingTask(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const startIndex = total === 0 ? 0 : (page - 1) * perPage + 1
  const endIndex = total === 0 ? 0 : Math.min(page * perPage, total)

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(next, totalPages))
      pageRef.current = clamped
      setPage(clamped)
    },
    [totalPages],
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <HousekeepingPageHeader
        propertyName={propertyName}
        pendingTasksCount={openTaskCount}
        onRefreshClick={handleRefresh}
        onExportClick={handleExport}
        viewMode={viewMode}
        onAddTaskClick={() => setIsAddTaskDialogOpen(true)}
        onAddChecklistClick={() => setIsAddChecklistDialogOpen(true)}
        canCreateTask={canCreateTask}
      />
      <div className="space-y-2">
        <HousekeepingViewSwitcher mode={viewMode} onModeChange={setViewMode} />
      </div>

      {viewMode === "tasks" ? (
        <>
          <HousekeepingFilter
            value={filters}
            onChange={setFilters}
            siteOptions={siteOptions}
            assigneeOptions={assigneeOptions}
          />
          <HousekeepingTable
            rows={rows}
            loading={loading}
            emptyMessage={
              total === 0 && !loading
                ? "No housekeeping tasks match the selected filters."
                : "No tasks on this page."
            }
            onView={handleViewTask}
            onEdit={handleOpenEditTask}
            onDelete={handleRequestDeleteTask}
            canEditTask={canEditTask}
            canDeleteTask={canDeleteTask}
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <div>
                Showing{" "}
                <span className="font-medium">
                  {startIndex}–{endIndex}
                </span>{" "}
                of <span className="font-medium">{total}</span> tasks
              </div>
              <PageSizeSelector value={perPage} onChange={setPerPage} disabled={loading} />
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
      ) : (
        <HousekeepingChecklistPanel
          propertyId={propertyId}
          refreshKey={checklistRefreshKey}
          canEditChecklist={canEditTask}
          canDeleteChecklist={canDeleteTask}
        />
      )}
      <AddTaskDialog
        open={canCreateTask && isAddTaskDialogOpen}
        onOpenChange={setIsAddTaskDialogOpen}
        siteOptions={siteOptions}
        assigneeOptions={assigneeOptions}
        isSubmitting={isCreatingTask}
        onSubmit={handleAddTask}
      />
      <AddChecklistDialog
        open={canCreateTask && isAddChecklistDialogOpen}
        onOpenChange={setIsAddChecklistDialogOpen}
        isSubmitting={isSavingChecklist}
        onSubmit={handleSaveChecklistTemplate}
      />
      <TaskDetailsDialog
        open={viewingTask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingTask(null)
          }
        }}
        task={viewingTask}
      />
      <EditTaskDialog
        open={canEditTask && isEditTaskDialogOpen}
        onOpenChange={setIsEditTaskDialogOpen}
        task={editingTask}
        siteOptions={siteOptions}
        assigneeOptions={assigneeOptions}
        isSubmitting={isUpdatingTask}
        onSubmit={handleEditTask}
      />
      <DeleteTaskConfirmationDialog
        open={canDeleteTask && taskPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTaskPendingDelete(null)
          }
        }}
        propertyId={propertyId}
        task={
          taskPendingDelete
            ? {
                id: taskPendingDelete.id,
                task: taskPendingDelete.task,
                siteName: taskPendingDelete.siteName,
              }
            : null
        }
        onDeleted={() => {
          void loadTasks()
        }}
      />
    </div>
  )
}
