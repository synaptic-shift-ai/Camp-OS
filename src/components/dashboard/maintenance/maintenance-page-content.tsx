"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import { useToast } from "@/hooks/use-toast"
import { MaintenanceFilter, type MaintenanceFilterValue } from "./maintenance-filter"
import { MaintenancePageHeader } from "./maintenance-page-header"
import { MaintenanceTable, type MaintenanceTaskRow } from "./maintenance-table"
import {
  AddTaskDialog,
  type AddMaintenanceTaskInput,
} from "./maintenance-dialog/add-task-dialog"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { EditTaskDialog } from "./maintenance-dialog/edit-task-dialog"
import { DeleteTaskConfirmationDialog } from "./maintenance-dialog/delete-task-confirmation-dialog"
import { TaskDetailsDialog } from "./maintenance-dialog/task-details-dialog"

type MaintenancePageContentProps = {
  propertyId: string
  propertyName: string
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  canCreateTask: boolean
  canEditTask: boolean
  canDeleteTask: boolean
}

function toApiStatus(
  status: AddMaintenanceTaskInput["status"],
): "open" | "in_progress" | "completed" {
  if (status === "In Progress") return "in_progress"
  if (status === "Completed") return "completed"
  return "open"
}

function fromApiStatus(status: string): MaintenanceTaskRow["status"] {
  if (status === "in_progress") return "In Progress"
  if (status === "completed") return "Completed"
  return "Open"
}

const INITIAL_FILTERS: MaintenanceFilterValue = {
  search: "",
  siteId: "all",
  assigneeId: "all",
  status: "all",
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

type ApiMaintenanceTask = {
  id: string
  site_id: string
  title: string
  description: string | null
  status: string
  staff_id: string | null
  site: { site_name: string | null; site_number: string | null } | null
}

export function MaintenancePageContent({
  propertyId,
  propertyName,
  siteOptions,
  assigneeOptions,
  canCreateTask,
  canEditTask,
  canDeleteTask,
}: MaintenancePageContentProps) {
  const { toast } = useToast()
  const [filters, setFilters] = useState<MaintenanceFilterValue>(INITIAL_FILTERS)
  const debouncedFilters = useDebouncedValue(filters, FILTER_DEBOUNCE_MS)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<MaintenanceTaskRow[]>([])
  const pageRef = useRef(1)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const assigneeOptionsRef = useRef(assigneeOptions)
  assigneeOptionsRef.current = assigneeOptions
  const assigneeOptionsKey = useMemo(
    () => assigneeOptions.map((option) => `${option.id}:${option.label}`).join("\u001f"),
    [assigneeOptions],
  )
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false)
  const [isUpdatingTask, setIsUpdatingTask] = useState(false)
  const [editingTask, setEditingTask] = useState<MaintenanceTaskRow | null>(null)
  const [taskPendingDelete, setTaskPendingDelete] = useState<MaintenanceTaskRow | null>(null)
  const [viewingTask, setViewingTask] = useState<MaintenanceTaskRow | null>(null)
  const filtersApiKey = useMemo(
    () =>
      `${debouncedFilters.search}|${debouncedFilters.siteId}|${debouncedFilters.assigneeId}|${debouncedFilters.status}`,
    [debouncedFilters],
  )

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))).sort(),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.siteName.toLowerCase().includes(normalizedSearch) ||
        row.task.toLowerCase().includes(normalizedSearch) ||
        (row.assignee?.toLowerCase().includes(normalizedSearch) ?? false)

      const matchesStatus = filters.status === "all" || row.status === filters.status
      return matchesSearch && matchesStatus
    })
  }, [filters, rows])

  const openTasksCount = useMemo(
    () => rows.filter((row) => row.status !== "Completed").length,
    [rows],
  )

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const search = debouncedFilters.search.trim()
      if (search.length > 0) {
        params.set("search", search)
      }
      if (debouncedFilters.status !== "all") {
        params.set("status", toApiStatus(debouncedFilters.status as AddMaintenanceTaskInput["status"]))
      }
      if (debouncedFilters.siteId !== "all") {
        params.set("siteId", debouncedFilters.siteId)
      }
      if (debouncedFilters.assigneeId !== "all") {
        params.set("assigneeId", debouncedFilters.assigneeId)
      }
      params.set("page", String(pageRef.current))
      params.set("per_page", String(perPage))

      const query = params.toString()
      const response = await fetch(
        `/api/v1/properties/${propertyId}/maintenance${query ? `?${query}` : ""}`,
      )
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to load maintenance tasks."
        throw new Error(message)
      }

      const opts = assigneeOptionsRef.current
      const assigneeLabelById = new Map(opts.map((option) => [option.id, option.label]))
      const mappedRows: MaintenanceTaskRow[] = (payload.data?.tasks ?? []).map((task: ApiMaintenanceTask) => ({
        id: task.id,
        siteId: task.site_id,
        siteName: task.site?.site_name?.trim() || task.site?.site_number || "Unknown site",
        task: task.title,
        assigneeId: task.staff_id,
        description: task.description,
        assignee: task.staff_id ? (assigneeLabelById.get(task.staff_id) ?? "Assigned") : null,
        status: fromApiStatus(task.status),
        priority: "Medium",
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
  }, [
    debouncedFilters.assigneeId,
    debouncedFilters.search,
    debouncedFilters.siteId,
    debouncedFilters.status,
    perPage,
    propertyId,
    toast,
  ])

  useEffect(() => {
    pageRef.current = 1
    setPage(1)
  }, [filtersApiKey, perPage])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks, assigneeOptionsKey, page])

  const handleRefresh = () => {
    void loadTasks()
  }

  const handleExport = (format: string) => {
    if (format !== "csv") return

    const filename = buildExportFilename("MAINTENANCE")
    exportToCsv<MaintenanceTaskRow>(filename, filteredRows, [
      { key: "siteName", header: "Site" },
      { key: "task", header: "Task" },
      {
        key: "assignee",
        header: "Asignee",
        accessor: (row) => row.assignee ?? "Unassigned",
      },
      { key: "status", header: "Status" },
      { key: "priority", header: "Priority" },
      { key: "category", header: "Category", accessor: (row) => row.category ?? "—" },
    ])

    toast({
      title: "Export ready",
      description: "Maintenance CSV has been downloaded.",
    })
  }

  const handleAddTask = async (input: AddMaintenanceTaskInput) => {
    if (!input.siteId) {
      throw new Error("Site is required.")
    }
    setIsCreatingTask(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/maintenance`, {
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
          "Failed to create maintenance task."
        throw new Error(message)
      }

      await loadTasks()

      toast({
        title: "Task added",
        description: "A new maintenance task has been added to the table.",
      })
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleOpenEditTask = (row: MaintenanceTaskRow) => {
    setEditingTask(row)
    setIsEditTaskDialogOpen(true)
  }

  const handleRequestDeleteTask = (row: MaintenanceTaskRow) => {
    setTaskPendingDelete(row)
  }

  const handleViewTask = (row: MaintenanceTaskRow) => {
    setViewingTask(row)
  }

  const handleEditTask = async (input: AddMaintenanceTaskInput & { id: string }) => {
    if (!input.siteId) {
      throw new Error("Site is required.")
    }
    setIsUpdatingTask(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/maintenance/${input.id}`, {
        method: "PATCH",
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
          "Failed to update maintenance task."
        throw new Error(message)
      }

      await loadTasks()

      toast({
        title: "Task updated",
        description: "Maintenance task details were updated successfully.",
      })
    } finally {
      setIsUpdatingTask(false)
    }
  }

  const emptyMessage =
    total === 0 && !loading
      ? "No maintenance tasks match the selected filters."
      : "No tasks available."
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
      <MaintenancePageHeader
        propertyName={propertyName}
        openTasksCount={openTasksCount}
        onRefreshClick={handleRefresh}
        onExportClick={handleExport}
        onAddTaskClick={() => setIsAddTaskDialogOpen(true)}
        canCreateTask={canCreateTask}
      />
      <MaintenanceFilter
        value={filters}
        onChange={setFilters}
        siteOptions={siteOptions}
        assigneeOptions={assigneeOptions}
      />
      <MaintenanceTable
        rows={filteredRows}
        loading={loading}
        emptyMessage={emptyMessage}
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
              {startIndex}-{endIndex}
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
      <AddTaskDialog
        open={canCreateTask && isAddTaskDialogOpen}
        onOpenChange={setIsAddTaskDialogOpen}
        siteOptions={siteOptions}
        assigneeOptions={assigneeOptions}
        isSubmitting={isCreatingTask}
        onSubmit={handleAddTask}
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
      <TaskDetailsDialog
        open={viewingTask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingTask(null)
          }
        }}
        task={viewingTask}
      />
    </div>
  )
}
