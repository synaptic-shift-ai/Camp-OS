"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import { useToast } from "@/hooks/use-toast"
import { MaintenanceFilter, type MaintenanceFilterValue } from "./wo-list/maintenance-filter"
import { MaintenancePageHeader } from "./wo-list/maintenance-page-header"
import { MaintenanceTable, type MaintenanceTaskRow } from "./wo-list/maintenance-table"
import {
  MaintenanceViewSwitcher,
  type MaintenanceViewMode,
} from "./maintenance-view-switcher"
import { CostReport } from "./cost-report/cost-report"
import { SchedulesList } from "./schedules/schedules-list"
import { VendorsTable } from "./vendors-list/vendors-table"
import { MaintenanceGuidesPanel } from "./maintenance-guides/maintenance-guides"
import {
  AddTaskDialog,
  maintenanceCategoryLabel,
  type AddMaintenanceTaskInput,
} from "./maintenance-dialog/add-task-dialog"
import {
  AddPreventiveDialog,
  type AddPreventiveScheduleInput,
} from "./maintenance-dialog/add-preventive-dialog"
import {
  AddGuideDialog,
  type AddGuideInput,
} from "./maintenance-dialog/add-guide-dialog"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { EditTaskDialog } from "./maintenance-dialog/edit-task-dialog"
import { DeleteTaskConfirmationDialog } from "./maintenance-dialog/delete-task-confirmation-dialog"
import {
  EditScheduleDialog,
  type AddPreventiveScheduleInput as EditScheduleTaskInput,
} from "./maintenance-dialog/edit-schedule-dialog"
import { DeleteScheduleConfirmationDialog } from "./schedules/delete-schedule-confirmation-dialog"
import { createClient } from "@/lib/supabase/client"

const TASK_IMAGES_BUCKET = "maintenance-and-housekeeping-images"

type MaintenancePageContentProps = {
  propertyId: string
  propertyName: string
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  canCreateTask: boolean
  canEditTask: boolean
  canDeleteTask: boolean
  canAssignWorkOrder: boolean
  canManageMaintenanceVendors: boolean
  canManageMaintenancePmSchedules: boolean
  canViewMaintenanceCostReports: boolean
  canEnterLaborCost: boolean
  showAssigneeFilter?: boolean
  selfAssigneeStaffId: string | null
  selfAssigneeLabel: string
}

function toApiStatus(
  status: AddMaintenanceTaskInput["status"],
): "open" | "in_progress" | "in_progress_vendor" | "on_hold" | "completed" | "cancelled" {
  if (status === "In Progress") return "in_progress"
  if (status === "In Progress (Vendor)") return "in_progress_vendor"
  if (status === "Completed") return "completed"
  if (status === "On Hold") return "on_hold"
  if (status === "Cancelled") return "cancelled"
  return "open"
}

function fromApiStatus(status: string): MaintenanceTaskRow["status"] {
  if (status === "in_progress") return "In Progress"
  if (status === "in_progress_vendor") return "In Progress (Vendor)"
  if (status === "completed") return "Completed"
  if (status === "on_hold") return "On Hold"
  if (status === "cancelled") return "Cancelled"
  return "Open"
}

const INITIAL_FILTERS: MaintenanceFilterValue = {
  search: "",
  siteId: "all",
  assigneeId: "all",
  status: "all",
  priority: "all",
  source: "all",
  category: "all",
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

function toApiPriority(
  priority: AddMaintenanceTaskInput["priority"],
): "low" | "medium" | "high" | "emergency" {
  if (priority === "Low") return "low"
  if (priority === "High") return "high"
  if (priority === "Emergency") return "emergency"
  return "medium"
}

function fromApiPriority(priority: string | null): MaintenanceTaskRow["priority"] {
  if (priority === "low") return "Low"
  if (priority === "high") return "High"
  if (priority === "emergency") return "Emergency"
  return "Medium"
}

function toApiSource(
  source: AddMaintenanceTaskInput["source"],
): "guest" | "housekeeping" | "staff" | "pm" | "checkout" {
  if (source === "Guest") return "guest"
  if (source === "Housekeeping") return "housekeeping"
  if (source === "PM") return "pm"
  if (source === "Checkout") return "checkout"
  return "staff"
}

function filterPriorityToApi(
  priority: MaintenanceFilterValue["priority"],
): "low" | "medium" | "high" | "emergency" | null {
  if (priority === "all") return null
  if (priority === "Low") return "low"
  if (priority === "High") return "high"
  if (priority === "Emergency") return "emergency"
  return "medium"
}

function filterSourceToApi(
  source: MaintenanceFilterValue["source"],
): "guest" | "housekeeping" | "staff" | "pm" | "checkout" | null {
  if (source === "all") return null
  if (source === "Guest") return "guest"
  if (source === "Housekeeping") return "housekeeping"
  if (source === "PM") return "pm"
  if (source === "Checkout") return "checkout"
  return "staff"
}

function filterCategoryToApi(
  category: MaintenanceFilterValue["category"],
): string | null {
  if (category === "all") return null
  return category
}

function fromApiSource(source: string | null): AddMaintenanceTaskInput["source"] {
  if (source === "guest") return "Guest"
  if (source === "housekeeping") return "Housekeeping"
  if (source === "pm") return "PM"
  if (source === "checkout") return "Checkout"
  return "Staff"
}

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase()
}

type ApiMaintenanceTask = {
  id: string
  site_id: string
  title: string
  description: string | null
  status: string
  priority: string | null
  category: string | null
  source: string | null
  estimated_labor_cost: number | null
  estimated_parts_cost: number | null
  is_suspected_damage: boolean | null
  vendor_id: string | null
  sla: number | null
  staff_id: string | null
  site: { site_name: string | null; site_number: string | null; site_type: string | null } | null
}

type VendorTableRow = {
  id: string
  displayId: string
  name: string
  service: string
  contact: string
  phone: string | null
  linkedWorkOrders: number | null
}

function toSiteTypeLabel(siteType: string | null | undefined): string | undefined {
  if (!siteType) return undefined
  return siteType
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function MaintenancePageContent({
  propertyId,
  propertyName,
  siteOptions,
  assigneeOptions,
  canCreateTask,
  canEditTask,
  canDeleteTask,
  canAssignWorkOrder,
  canManageMaintenanceVendors,
  canManageMaintenancePmSchedules,
  canViewMaintenanceCostReports,
  canEnterLaborCost,
  showAssigneeFilter = true,
  selfAssigneeStaffId,
  selfAssigneeLabel,
}: MaintenancePageContentProps) {
  const router = useRouter()
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
  const [isAddVendorDialogOpen, setIsAddVendorDialogOpen] = useState(false)
  const [isAddPreventiveDialogOpen, setIsAddPreventiveDialogOpen] = useState(false)
  const [isAddGuideDialogOpen, setIsAddGuideDialogOpen] = useState(false)
  const [isSavingGuide, setIsSavingGuide] = useState(false)
  const [guideRefreshKey, setGuideRefreshKey] = useState(0)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isCreatingPreventiveSchedule, setIsCreatingPreventiveSchedule] = useState(false)
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false)
  const [isUpdatingTask, setIsUpdatingTask] = useState(false)
  const [editingTask, setEditingTask] = useState<MaintenanceTaskRow | null>(null)
  const [taskPendingDelete, setTaskPendingDelete] = useState<MaintenanceTaskRow | null>(null)
  const [viewMode, setViewMode] = useState<MaintenanceViewMode>("wo_list")
  const [vendorOptions, setVendorOptions] = useState<Array<{ id: string; label: string }>>([])
  const [vendorRows, setVendorRows] = useState<VendorTableRow[]>([])
  const [schedulesRefreshKey, setSchedulesRefreshKey] = useState(0)
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null)
  const [isEditScheduleDialogOpen, setIsEditScheduleDialogOpen] = useState(false)
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false)
  const [deletingSchedule, setDeletingSchedule] = useState<any | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false)

  const [_isGeneratingWorkOrder, setIsGeneratingWorkOrder] = useState(false)

  const loadVendorOptions = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/vendors`)
      const payload = await response.json()
      if (!response.ok || !payload?.success) return
      const next = payload.data?.vendorOptions as Array<{ id: string; label: string }> | undefined
      if (Array.isArray(next)) setVendorOptions(next)
      const vendorList = payload.data?.vendors as VendorTableRow[] | undefined
      if (Array.isArray(vendorList)) setVendorRows(vendorList)
    } catch {
      /* ignore — vendor link is optional */
    }
  }, [propertyId])

  useEffect(() => {
    void loadVendorOptions()
  }, [loadVendorOptions])

  useEffect(() => {
    if (isAddTaskDialogOpen || isEditTaskDialogOpen) void loadVendorOptions()
  }, [isAddTaskDialogOpen, isEditTaskDialogOpen, loadVendorOptions])

  useEffect(() => {
    if (viewMode === "analytics" && !canViewMaintenanceCostReports) {
      setViewMode("wo_list")
      return
    }
    if (viewMode === "schedules" && !canManageMaintenancePmSchedules) {
      setViewMode("wo_list")
      return
    }
    if (viewMode === "vendors" && !canManageMaintenanceVendors) {
      setViewMode("wo_list")
    }
  }, [
    viewMode,
    canViewMaintenanceCostReports,
    canManageMaintenancePmSchedules,
    canManageMaintenanceVendors,
  ])

  useEffect(() => {
    if (showAssigneeFilter || filters.assigneeId === "all") return
    setFilters((previous) => ({ ...previous, assigneeId: "all" }))
  }, [filters.assigneeId, showAssigneeFilter])

  const filtersApiKey = useMemo(
    () =>
      `${debouncedFilters.search}|${debouncedFilters.siteId}|${debouncedFilters.assigneeId}|${debouncedFilters.status}|${debouncedFilters.priority}|${debouncedFilters.source}|${debouncedFilters.category}`,
    [debouncedFilters],
  )

  const filteredRows = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase()
    if (normalizedSearch.length === 0) return rows

    return rows.filter((row) => {
      return (
        row.siteName.toLowerCase().includes(normalizedSearch) ||
        row.task.toLowerCase().includes(normalizedSearch) ||
        (row.assignee?.toLowerCase().includes(normalizedSearch) ?? false)
      )
    })
  }, [filters.search, rows])

  const categoryOptions = useMemo(() => {
    const categoryMap = new Map<string, string>()
    for (const row of rows) {
      if (row.category) {
        categoryMap.set(row.category.toLowerCase(), row.category)
      }
    }
    return Array.from(categoryMap.entries()).map(([id, label]) => ({ id, label }))
  }, [rows])

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
      const priorityParam = filterPriorityToApi(debouncedFilters.priority)
      if (priorityParam) {
        params.set("priority", priorityParam)
      }
      const sourceParam = filterSourceToApi(debouncedFilters.source)
      if (sourceParam) {
        params.set("source", sourceParam)
      }
      const categoryParam = filterCategoryToApi(debouncedFilters.category)
      if (categoryParam) {
        params.set("category", categoryParam)
      }
      if (debouncedFilters.siteId !== "all") {
        params.set("siteId", debouncedFilters.siteId)
      }
      if (showAssigneeFilter && debouncedFilters.assigneeId !== "all") {
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
        woNumber: (task as any).wo_number ?? null,
        siteId: task.site_id,
        siteName: task.site?.site_name?.trim() || task.site?.site_number || "Unknown site",
        siteTypeLabel: toSiteTypeLabel(task.site?.site_type),
        task: task.title,
        assigneeId: task.staff_id,
        description: task.description,
        assignee: task.staff_id
          ? (assigneeLabelById.get(task.staff_id) ?? "Assigned")
          : task.vendor_id
            ? "Vendor Assigned"
            : null,
        status: fromApiStatus(task.status),
        priority: fromApiPriority(task.priority),
        category: task.category ? maintenanceCategoryLabel(task.category) : undefined,
        source: fromApiSource(task.source),
        estimatedLaborCost: task.estimated_labor_cost,
        estimatedPartsCost: task.estimated_parts_cost,
        isSuspectedDamage: task.is_suspected_damage ?? false,
        vendorId: task.vendor_id,
        sla: task.sla,
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
    debouncedFilters.priority,
    debouncedFilters.source,
    debouncedFilters.category,
    perPage,
    propertyId,
    showAssigneeFilter,
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
      variant: "success",
    })
  }

  const handleAddPreventiveSchedule = async (input: AddPreventiveScheduleInput) => {
    setIsCreatingPreventiveSchedule(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/maintenance/schedules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: input.name,
          description: input.description?.trim() ? input.description.trim() : null,
          site_id: input.siteId ?? null,
          assigned_to: input.assigneeId ?? null,
          frequency: input.frequency,
          days: input.days ?? null,
          schedule_date: input.scheduleDate ?? null,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to create schedule."
        throw new Error(message)
      }

      toast({
        title: "Schedule added",
        description: "The preventive schedule has been saved.",
        variant: "success",
      })
      setIsAddPreventiveDialogOpen(false)
      setSchedulesRefreshKey((prev) => prev + 1)
    } finally {
      setIsCreatingPreventiveSchedule(false)
    }
  }

  const handleEditSchedule = (schedule: any) => {
    setEditingSchedule(schedule)
    setIsEditScheduleDialogOpen(true)
  }

  const handleEditScheduleSubmit = async (input: EditScheduleTaskInput) => {
    setIsUpdatingSchedule(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/schedules/${editingSchedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      )
      if (!res.ok) throw new Error("Failed to update schedule")
      toast({
        title: "Schedule updated",
        variant: "success",
      })
      setIsEditScheduleDialogOpen(false)
      setSchedulesRefreshKey((prev) => prev + 1)
    } catch {
      toast({ title: "Failed to update schedule", variant: "destructive" })
    } finally {
      setIsUpdatingSchedule(false)
    }
  }

  const handleDeleteSchedule = (schedule: any) => {
    setDeletingSchedule(schedule)
    setIsDeleteDialogOpen(true)
  }

  const handleSaveGuide = async (input: AddGuideInput) => {
    setIsSavingGuide(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/maintenance/guides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to save maintenance guide."
        throw new Error(message)
      }
      setGuideRefreshKey((key) => key + 1)
      toast({
        title: "Guide saved",
        description: "Maintenance guide created successfully.",
        variant: "success",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save maintenance guide."
      toast({
        title: "Unable to save guide",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSavingGuide(false)
    }
  }

  const handleConfirmDelete = async () => {
    setIsDeletingSchedule(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/schedules/${deletingSchedule.id}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error("Failed to delete schedule")
      toast({
        title: "Schedule deleted",
        variant: "success",
      })
      setIsDeleteDialogOpen(false)
      setSchedulesRefreshKey((prev) => prev + 1)
    } catch {
      toast({ title: "Failed to delete schedule", variant: "destructive" })
    } finally {
      setIsDeletingSchedule(false)
    }
  }

  const handleGenerateNow = async (scheduleId: string) => {
    setIsGeneratingWorkOrder(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/schedules/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: data.error ?? "Failed to generate work order",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Work order created",
          variant: "success",
        })
        setSchedulesRefreshKey((prev) => prev + 1)
        await loadTasks()
      }
    } catch {
      toast({ title: "Failed to generate work order", variant: "destructive" })
    } finally {
      setIsGeneratingWorkOrder(false)
    }
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
          priority: toApiPriority(input.priority),
          category: input.category,
          source: toApiSource(input.source),
          estimatedLaborCost: input.estimatedLaborCost ?? null,
          estimatedPartsCost: input.estimatedPartsCost ?? null,
          isSuspectedDamage: input.isSuspectedDamage ?? false,
          vendorId: input.vendorId ?? null,
          sla: input.sla ?? null,
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

      const maintenanceTaskId = payload?.data?.maintenanceTask?.id as string | undefined
      if (!maintenanceTaskId) {
        throw new Error("Task created but id was not returned.")
      }

      const imageFiles = input.images ?? []
      if (imageFiles.length > 0) {
        const supabase = createClient()
        for (const file of imageFiles) {
          const safeName = sanitizeFileName(file.name) || "image"
          const storagePath = `property/${propertyId}/maintenance/${maintenanceTaskId}/${crypto.randomUUID()}-${safeName}`

          const { error: uploadError } = await supabase.storage
            .from(TASK_IMAGES_BUCKET)
            .upload(storagePath, file, {
              upsert: false,
              contentType: file.type,
            })

          if (uploadError) {
            throw new Error(uploadError.message)
          }

          const registerResponse = await fetch(
            `/api/v1/properties/${propertyId}/maintenance/${maintenanceTaskId}/images`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ storagePath }),
            },
          )
          const registerPayload = await registerResponse.json()

          if (!registerResponse.ok || !registerPayload?.success) {
            const message = registerPayload?.error?.message ?? "Failed to save uploaded image."
            throw new Error(message)
          }
        }
      }

      await loadTasks()

      toast({
        title: "Task added",
        description: "A new maintenance task has been added to the table.",
        variant: "success",
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
    router.push(`/dashboard/${propertyId}/maintenance/${row.id}`)
  }

  const handleEditTask = async (input: AddMaintenanceTaskInput & { id: string }) => {
    if (!input.siteId) {
      throw new Error("Site is required.")
    }
    setIsUpdatingTask(true)
    try {
      const patchBody: Record<string, unknown> = {
        siteId: input.siteId,
        title: input.task,
        description: input.description?.trim() ? input.description.trim() : null,
        status: toApiStatus(input.status),
        priority: toApiPriority(input.priority),
        category: input.category,
        source: toApiSource(input.source),
        estimatedLaborCost: input.estimatedLaborCost ?? null,
        estimatedPartsCost: input.estimatedPartsCost ?? null,
        isSuspectedDamage: input.isSuspectedDamage,
        vendorId: input.vendorId ?? null,
        sla: input.sla ?? null,
      }
      if (canAssignWorkOrder) {
        patchBody.staffId = input.assigneeId ?? null
      }

      const response = await fetch(`/api/v1/properties/${propertyId}/maintenance/${input.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchBody),
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
        variant: "success",
      })

      // Upload new images after successful update
      const imageFiles = input.images ?? []
      if (imageFiles.length > 0) {
        const supabase = createClient()
        for (const file of imageFiles) {
          const safeName = sanitizeFileName(file.name) || "image"
          const storagePath = `property/${propertyId}/maintenance/${input.id}/${crypto.randomUUID()}-${safeName}`

          const { error: uploadError } = await supabase.storage
            .from(TASK_IMAGES_BUCKET)
            .upload(storagePath, file, {
              upsert: false,
              contentType: file.type,
            })

          if (uploadError) {
            throw new Error(uploadError.message)
          }

          const registerResponse = await fetch(
            `/api/v1/properties/${propertyId}/maintenance/${input.id}/images`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ storagePath }),
            },
          )
          const registerPayload = await registerResponse.json()

          if (!registerResponse.ok || !registerPayload?.success) {
            const message = registerPayload?.error?.message ?? "Failed to save uploaded image."
            throw new Error(message)
          }
        }
      }
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

  const headerPrimaryActionLabel =
    viewMode === "wo_list" ? "Add Task" : viewMode === "vendors" ? "New Vendor" : viewMode === "guides" ? "New Guide" : "New Schedule"
  const headerPrimaryActionVisible =
    (viewMode === "wo_list" && canCreateTask) ||
    (viewMode === "vendors" && canManageMaintenanceVendors) ||
    (viewMode === "schedules" && canManageMaintenancePmSchedules) ||
    (viewMode === "guides" && canCreateTask)
  const handleHeaderPrimaryAction = () => {
    if (viewMode === "wo_list") {
      setIsAddTaskDialogOpen(true)
      return
    }
    if (viewMode === "vendors") {
      setIsAddVendorDialogOpen(true)
      return
    }
    if (viewMode === "guides") {
      setIsAddGuideDialogOpen(true)
      return
    }
    if (viewMode === "schedules") {
      setIsAddPreventiveDialogOpen(true)
      return
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <MaintenancePageHeader
        propertyName={propertyName}
        openTasksCount={openTasksCount}
        onRefreshClick={handleRefresh}
        onExportClick={handleExport}
        onPrimaryActionClick={handleHeaderPrimaryAction}
        primaryActionLabel={headerPrimaryActionLabel}
        showPrimaryAction={headerPrimaryActionVisible}
      />
      <MaintenanceViewSwitcher
        mode={viewMode}
        onModeChange={setViewMode}
        showCostReport={canViewMaintenanceCostReports}
        showSchedules={canManageMaintenancePmSchedules}
        showVendorsList={canManageMaintenanceVendors}
        showGuides
      />

      {viewMode === "wo_list" ? (
        <>
          <MaintenanceFilter
            value={filters}
            onChange={setFilters}
            siteOptions={siteOptions}
            assigneeOptions={assigneeOptions}
            categoryOptions={categoryOptions}
            showAssigneeFilter={showAssigneeFilter}
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
            canViewCosts={canEnterLaborCost}
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
        </>
      ) : viewMode === "analytics" ? (
        <CostReport
          propertyId={propertyId}
          propertyName={propertyName}
          onViewAllWorkOrders={() => setViewMode("wo_list")}
        />
      ) : viewMode === "schedules" ? (
        <SchedulesList
          propertyId={propertyId}
          siteOptions={siteOptions}
          assigneeOptions={assigneeOptions}
          refreshKey={schedulesRefreshKey}
          onEdit={handleEditSchedule}
          onDelete={handleDeleteSchedule}
          onGenerateNow={handleGenerateNow}
        />
      ) : viewMode === "vendors" ? (
        <VendorsTable
          propertyId={propertyId}
          vendors={vendorRows}
          isAddVendorDialogOpen={isAddVendorDialogOpen}
          onAddVendorDialogOpenChange={setIsAddVendorDialogOpen}
          onVendorCreated={loadVendorOptions}
        />
      ) : viewMode === "guides" ? (
        <MaintenanceGuidesPanel
          propertyId={propertyId}
          refreshKey={guideRefreshKey}
          canEditGuide={canEditTask}
          canDeleteGuide={canDeleteTask}
        />
      ) : null}
      <AddPreventiveDialog
        open={canManageMaintenancePmSchedules && isAddPreventiveDialogOpen}
        onOpenChange={setIsAddPreventiveDialogOpen}
        siteOptions={siteOptions}
        assigneeOptions={assigneeOptions}
        isSubmitting={isCreatingPreventiveSchedule}
        onSubmit={handleAddPreventiveSchedule}
      />
      <AddTaskDialog
        open={canCreateTask && isAddTaskDialogOpen}
        onOpenChange={setIsAddTaskDialogOpen}
        siteOptions={siteOptions}
        assigneeOptions={assigneeOptions}
        canAssignWorkOrder={canAssignWorkOrder}
        selfAssigneeStaffId={selfAssigneeStaffId}
        selfAssigneeLabel={selfAssigneeLabel}
        isSubmitting={isCreatingTask}
        vendorOptions={vendorOptions}
        onSubmit={handleAddTask}
      />
      <EditTaskDialog
        open={canEditTask && isEditTaskDialogOpen}
        onOpenChange={setIsEditTaskDialogOpen}
        task={editingTask}
        siteOptions={siteOptions}
        assigneeOptions={assigneeOptions}
        canAssignWorkOrder={canAssignWorkOrder}
        isSubmitting={isUpdatingTask}
        vendorOptions={vendorOptions}
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
      <EditScheduleDialog
        open={isEditScheduleDialogOpen}
        onOpenChange={setIsEditScheduleDialogOpen}
        schedule={editingSchedule}
        siteOptions={siteOptions}
        assigneeOptions={assigneeOptions}
        isSubmitting={isUpdatingSchedule}
        onSubmit={handleEditScheduleSubmit}
      />
      <DeleteScheduleConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        scheduleName={deletingSchedule?.name ?? ""}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingSchedule}
      />
      <AddGuideDialog
        open={canCreateTask && isAddGuideDialogOpen}
        onOpenChange={setIsAddGuideDialogOpen}
        isSubmitting={isSavingGuide}
        onSubmit={handleSaveGuide}
      />
    </div>
  )
}
