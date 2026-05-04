"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Truck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import { StatusChangeReasonDialog } from "../maintenance-dialog/status-change-reason-dialog"
import { ReassignTaskDialog } from "../../housekeeping/housekeeping-dialog.tsx/reassign-task-dialog"
import { AssignVendorDialog } from "../maintenance-dialog/assign-vendor-dialog"

type AssigneeOption = {
  id: string
  label: string
}

type MaintenanceViewProps = {
  propertyId: string
  propertyName: string
  maintenanceId: string
  assigneeOptions: AssigneeOption[]
  canEditTask: boolean
  canAssignWo: boolean
  canHold?: boolean
  canResume?: boolean
  canCancel?: boolean
  canEnterLaborCost?: boolean
}

type TaskDetails = {
  id: string
  wo_number?: string | null
  title: string
  description: string | null
  status: string
  priority: string | null
  category: string | null
  source: string | null
  estimated_labor_cost: number | null
  estimated_parts_cost: number | null
  actual_labor_cost: number | null
  actual_parts_cost: number | null
  is_suspected_damage: boolean | null
  vendor_invoice_number: string | null
  vendor_invoice_cost: number | null
  closeout_notes: string | null
  sla: number | null
  vendor_id: string | null
  staff_id: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  on_hold_at: string | null
  on_hold_reason: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  scheduled_start: string | null
  due_date: string | null
  site: { site_name: string | null; site_number: string | null; site_type: string | null } | null
}

function formatDateTime(date: string | null): string {
  if (!date) return "—"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function statusLabel(status: string): string {
  if (status === "in_progress") return "In Progress"
  if (status === "in_progress_vendor") return "In Progress (Vendor)"
  if (status === "on_hold") return "On Hold"
  if (status === "completed") return "Completed"
  if (status === "cancelled") return "Cancelled"
  return "Open"
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700"
  if (status === "in_progress_vendor") return "border-violet-200 bg-violet-50 text-violet-700"
  if (status === "on_hold") return "border-amber-300 bg-amber-50 text-amber-700"
  if (status === "cancelled") return "border-gray-200 bg-gray-50 text-gray-500"
  return "border-amber-200 bg-amber-50 text-amber-700"
}

function priorityLabel(priority: string | null): string {
  if (priority === "emergency") return "Emergency"
  if (priority === "high") return "High"
  if (priority === "low") return "Low"
  return "Medium"
}

function priorityBadgeClass(priority: string | null): string {
  if (priority === "emergency") return "border-red-200 bg-red-50 text-red-700"
  if (priority === "high") return "border-orange-200 bg-orange-50 text-orange-700"
  if (priority === "low") return "border-zinc-200 bg-zinc-50 text-zinc-700"
  return "border-blue-200 bg-blue-50 text-blue-700"
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const pad = (n: number) => String(n).padStart(2, "0")
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

const formatCurrency = (val: number | null) =>
  val != null && val > 0 ? `$${val.toFixed(2)}` : "—"

type StepDef = { label: string; apiStatuses: string[] }

const DEFAULT_STEPS: StepDef[] = [
  { label: "Open", apiStatuses: ["open"] },
  { label: "In Progress", apiStatuses: ["in_progress", "in_progress_vendor"] },
  { label: "Complete", apiStatuses: ["completed"] },
]

const VENDOR_STEPS: StepDef[] = [
  { label: "Open", apiStatuses: ["open"] },
  { label: "Vendor Work", apiStatuses: ["in_progress_vendor"] },
  { label: "Complete", apiStatuses: ["completed"] },
]

const ON_HOLD_STEPS: StepDef[] = [
  { label: "Open", apiStatuses: ["open"] },
  { label: "On Hold", apiStatuses: ["on_hold"] },
  { label: "Complete", apiStatuses: ["completed"] },
]

type ActivityEntry = {
  id: string
  label: string
  detail: string | null
  timestamp: string
}

type TaskImageItem = {
  id: string
  storagePath: string
}

const TASK_IMAGES_BUCKET = "maintenance-and-housekeeping-images"

export function MaintenanceView({
  propertyId,
  propertyName,
  maintenanceId,
  assigneeOptions,
  canEditTask,
  canAssignWo,
  canHold = false,
  canResume = false,
  canCancel = false,
  canEnterLaborCost = false,
}: MaintenanceViewProps) {
  const { toast } = useToast()
  const [task, setTask] = useState<TaskDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isReopening, setIsReopening] = useState(false)
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isStatusChanging, setIsStatusChanging] = useState(false)
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [isReassigning, setIsReassigning] = useState(false)
  const [taskImages, setTaskImages] = useState<TaskImageItem[]>([])
  // Actual cost editing state
  const [editLaborCost, setEditLaborCost] = useState<string>("")
  const [editPartsCost, setEditPartsCost] = useState<string>("")
  const [isSavingCosts, setIsSavingCosts] = useState(false)
  // Vendor closeout state
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("")
  const [vendorInvoiceCost, setVendorInvoiceCost] = useState("")
  const [closeoutNotes, setCloseoutNotes] = useState("")
  const [isAssigningVendor, setIsAssigningVendor] = useState(false)
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false)
  const [isCompletingVendor, setIsCompletingVendor] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [now, setNow] = useState(Date.now())

  const assigneeLabelById = useMemo(
    () => new Map(assigneeOptions.map((option) => [option.id, option.label])),
    [assigneeOptions],
  )

  // ── Data fetching ──

  const loadTask = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to load maintenance task."
        throw new Error(message)
      }

      const raw = payload.data?.maintenanceTask
      if (!raw) throw new Error("Task not found.")

      setTask({
        id: raw.id,
        wo_number: raw.woNumber ?? raw.wo_number ?? null,
        title: raw.title,
        description: raw.description,
        status: raw.status,
        priority: raw.priority,
        category: raw.category,
        source: raw.source,
        estimated_labor_cost: raw.estimatedLaborCost ?? raw.estimated_labor_cost ?? null,
        estimated_parts_cost: raw.estimatedPartsCost ?? raw.estimated_parts_cost ?? null,
        actual_labor_cost: raw.actualLaborCost ?? raw.actual_labor_cost ?? null,
        actual_parts_cost: raw.actualPartsCost ?? raw.actual_parts_cost ?? null,
        is_suspected_damage: raw.isSuspectedDamage ?? raw.is_suspected_damage ?? false,
        vendor_invoice_number: raw.vendorInvoiceNumber ?? raw.vendor_invoice_number ?? null,
        vendor_invoice_cost: raw.vendorInvoiceCost ?? raw.vendor_invoice_cost ?? null,
        closeout_notes: raw.closeoutNotes ?? raw.closeout_notes ?? null,
        sla: raw.sla,
        vendor_id: raw.vendorId ?? raw.vendor_id,
        staff_id: raw.staffId ?? raw.staff_id,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        started_at: raw.started_at ?? null,
        completed_at: raw.completed_at ?? null,
        on_hold_at: raw.on_hold_at ?? null,
        on_hold_reason: raw.on_hold_reason ?? null,
        cancelled_at: raw.cancelled_at ?? null,
        cancelled_reason: raw.cancelled_reason ?? null,
        scheduled_start: raw.scheduled_start ?? null,
        due_date: raw.due_date ?? null,
        site: raw.site ?? null,
      })
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load maintenance task."
      setError(message)
      setTask(null)
    } finally {
      setLoading(false)
    }
  }, [propertyId, maintenanceId])

  useEffect(() => {
    void loadTask()
  }, [loadTask])

  const loadTaskImages = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}/images`,
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message = payload?.error?.message ?? "Failed to load task images."
        throw new Error(message)
      }

      const images = Array.isArray(payload?.data?.images)
        ? payload.data.images.map((row: { id: string; storage_path: string }) => ({
            id: row.id,
            storagePath: row.storage_path,
          }))
        : []
      setTaskImages(images)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load task images."
      toast({
        title: "Unable to load photos",
        description: message,
        variant: "destructive",
      })
    }
  }, [maintenanceId, propertyId, toast])

  useEffect(() => {
    void loadTaskImages()
  }, [loadTaskImages])

  // ── Live timer for in-progress tasks ──

  useEffect(() => {
    if (task?.actual_labor_cost != null) {
      setEditLaborCost(String(task.actual_labor_cost))
    }
    if (task?.actual_parts_cost != null) {
      setEditPartsCost(String(task.actual_parts_cost))
    }
  }, [task?.actual_labor_cost, task?.actual_parts_cost])

  useEffect(() => {
    if (task?.status === "in_progress" || task?.status === "in_progress_vendor") {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [task?.status])

  const workElapsedSeconds = useMemo(() => {
    if (!task?.started_at) return null
    const startMs = new Date(task.started_at).getTime()
    const endMs =
      task.completed_at
        ? new Date(task.completed_at).getTime()
        : task.status === "on_hold" && task.on_hold_at
          ? new Date(task.on_hold_at).getTime()
          : now
    return Math.max(0, Math.floor((endMs - startMs) / 1000))
  }, [task?.started_at, task?.completed_at, task?.status, task?.on_hold_at, now])

  const workTimerDisplay = useMemo(() => {
    if (workElapsedSeconds === null) return "Not started"
    return formatDuration(workElapsedSeconds)
  }, [workElapsedSeconds])

  // ── SLA timer ──

  const slaSecondsRemaining = useMemo(() => {
    if (!task?.sla || !task?.created_at) return null
    if (task.status === "completed" || task.status === "cancelled") return null

    // Use scheduled_start as SLA reference when available
    const slaRefMs = task.scheduled_start
      ? new Date(task.scheduled_start).getTime()
      : null

    if (!task.started_at || task.status === "open") {
      if (slaRefMs) {
        const deadlineMs = slaRefMs + task.sla * 3600 * 1000
        return Math.max(0, Math.floor((deadlineMs - now) / 1000))
      }
      return task.sla * 3600
    }

    const deadlineMs = task.due_date
      ? new Date(task.due_date).getTime()
      : (slaRefMs ?? new Date(task.started_at).getTime()) + task.sla * 3600 * 1000
    const slaNowMs =
      task.status === "on_hold" && task.on_hold_at
        ? new Date(task.on_hold_at).getTime()
        : now
    const remaining = Math.max(0, Math.floor((deadlineMs - slaNowMs) / 1000))
    return remaining
  }, [task?.sla, task?.created_at, task?.started_at, task?.status, task?.on_hold_at, task?.due_date, task?.scheduled_start, now])

  const slaDisplay = useMemo(() => {
    if (slaSecondsRemaining === null) return null
    return formatDuration(slaSecondsRemaining)
  }, [slaSecondsRemaining])

  const isSlaBreached =
    slaSecondsRemaining !== null &&
    slaSecondsRemaining === 0 &&
    task?.status !== "completed" &&
    task?.status !== "cancelled"

  // ── Stepper ──

  const activeStepIndex = useMemo(() => {
    if (!task) return 0
    const steps = task.status === "on_hold" ? ON_HOLD_STEPS : DEFAULT_STEPS
    const index = steps.findIndex((step) => step.apiStatuses.includes(task.status))
    return index >= 0 ? index : 0
  }, [task])

  const stepperSteps = useMemo(
    () => (task?.status === "on_hold" ? ON_HOLD_STEPS : task?.status === "in_progress_vendor" ? VENDOR_STEPS : DEFAULT_STEPS),
    [task?.status],
  )

  // ── Activity timeline ──

  const activityEntries = useMemo<ActivityEntry[]>(() => {
    if (!task) return []
    const entries: ActivityEntry[] = []

    if (task.cancelled_at) {
      entries.push({
        id: "cancelled",
        label: "Work order cancelled",
        detail: task.cancelled_reason,
        timestamp: task.cancelled_at,
      })
    }

    if (task.completed_at) {
      entries.push({
        id: "completed",
        label: "Work order completed",
        detail: null,
        timestamp: task.completed_at,
      })
    }

    if (task.on_hold_reason && !task.on_hold_at && ["in_progress", "in_progress_vendor"].includes(task.status)) {
      entries.push({
        id: "on_hold_requested",
        label: "On-hold requested",
        detail: task.on_hold_reason,
        timestamp: task.updated_at,
      })
    }

    if (task.on_hold_at) {
      entries.push({
        id: "on_hold",
        label: "Put on hold",
        detail: task.on_hold_reason,
        timestamp: task.on_hold_at,
      })
    }

    if (task.started_at) {
      entries.push({
        id: "started",
        label: "Work started",
        detail: null,
        timestamp: task.started_at,
      })
    }

    entries.push({
      id: "created",
      label: "Work order created",
      detail: null,
      timestamp: task.created_at,
    })

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [task])

  // ── Visibility flags ──

  const showStart = task?.status === "open" && canEditTask
  const showComplete = task?.status === "in_progress" && canEditTask
  const showReopen = (task?.status === "completed" || task?.status === "cancelled") && canEditTask
  const hasPendingOnHoldRequest =
    ["in_progress", "in_progress_vendor"].includes(task?.status ?? "") &&
    Boolean(task?.on_hold_reason) &&
    !task?.on_hold_at
  const showHold =
    canHold &&
    (task?.status === "in_progress" || task?.status === "in_progress_vendor") &&
    !hasPendingOnHoldRequest
  const showApproveHold = canResume && hasPendingOnHoldRequest
  const showResume = canResume && task?.status === "on_hold"
  const showCancel = canCancel && ["open", "in_progress", "on_hold"].includes(task?.status ?? "")
  const showReassign = canAssignWo && !["completed", "cancelled"].includes(task?.status ?? "")
  const showAssignVendor = task?.status === "open" && canEditTask && !task?.vendor_id
  const showCloseout = task?.status === "in_progress_vendor" && canEditTask

  // ── Handlers ──

  const mutate = useCallback(() => {
    void loadTask()
  }, [loadTask])

  const handleStart = async () => {
    if (!task || task.status !== "open" || isStarting) return
    setIsStarting(true)
    try {
      const targetStatus = task.vendor_id ? "in_progress_vendor" : "in_progress"
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to start work order."
        throw new Error(message)
      }
      const updated = payload?.data?.maintenanceTask as Partial<TaskDetails> | undefined
      const startedAt =
        typeof updated?.started_at === "string" ? updated.started_at : new Date().toISOString()
      setTask((previous) =>
        previous
          ? {
              ...previous,
              status: targetStatus,
              started_at: startedAt,
              updated_at:
                typeof updated?.updated_at === "string" ? updated.updated_at : previous.updated_at,
            }
          : previous,
      )
      setNow(Date.now())
      toast({
        title: "Work order started",
        variant: "success",
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start work order."
      toast({ title: "Unable to start", description: message, variant: "destructive" })
    } finally {
      setIsStarting(false)
    }
  }

  const handleComplete = async () => {
    if (!task || !["in_progress", "in_progress_vendor"].includes(task.status) || isCompleting) return
    setIsCompleting(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to complete work order."
        throw new Error(message)
      }
      toast({
        title: "Work order completed",
        variant: "success",
      })
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete work order."
      toast({ title: "Unable to complete", description: message, variant: "destructive" })
    } finally {
      setIsCompleting(false)
    }
  }

  const handleReopen = async () => {
    if (!task || isReopening) return
    setIsReopening(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "open" }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to reopen work order."
        throw new Error(message)
      }
      toast({ title: "Work order reopened" })
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reopen work order."
      toast({ title: "Unable to reopen", description: message, variant: "destructive" })
    } finally {
      setIsReopening(false)
    }
  }

  const handleRequestOnHold = async (reason: string) => {
    setIsStatusChanging(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ on_hold_reason: reason }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to put on hold",
        )
      }
      const updated = payload?.data?.maintenanceTask as Partial<TaskDetails> | undefined
      setTask((previous) =>
        previous
          ? {
              ...previous,
              on_hold_reason: reason,
              updated_at:
                typeof updated?.updated_at === "string" ? updated.updated_at : previous.updated_at,
            }
          : previous,
      )
      toast({ title: "On-hold request submitted", variant: "success" })
      setIsHoldDialogOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to request on-hold."
      toast({ title: "Unable to hold", description: message, variant: "destructive" })
    } finally {
      setIsStatusChanging(false)
    }
  }

  const handlePutOnHold = async (reason: string) => {
    if (!task || task.status === "on_hold" || isStatusChanging) return
    setIsStatusChanging(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "on_hold", on_hold_reason: reason }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to put on hold",
        )
      }
      const updated = payload?.data?.maintenanceTask as Partial<TaskDetails> | undefined
      setTask((previous) =>
        previous
          ? {
              ...previous,
              status: "on_hold",
              on_hold_at:
                typeof updated?.on_hold_at === "string" ? updated.on_hold_at : new Date().toISOString(),
              on_hold_reason:
                typeof updated?.on_hold_reason === "string" ? updated.on_hold_reason : reason,
              updated_at:
                typeof updated?.updated_at === "string" ? updated.updated_at : previous.updated_at,
            }
          : previous,
      )
      toast({ title: "Work order put on hold", variant: "success" })
      setIsHoldDialogOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to put on hold."
      toast({ title: "Unable to hold", description: message, variant: "destructive" })
    } finally {
      setIsStatusChanging(false)
    }
  }

  const handleApproveOnHold = async () => {
    if (!task || task.status === "on_hold" || isStatusChanging) return
    setIsStatusChanging(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "on_hold" }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to approve on-hold request",
        )
      }
      const updated = payload?.data?.maintenanceTask as Partial<TaskDetails> | undefined
      setTask((previous) =>
        previous
          ? {
              ...previous,
              status: "on_hold",
              on_hold_at:
                typeof updated?.on_hold_at === "string" ? updated.on_hold_at : new Date().toISOString(),
              on_hold_reason:
                typeof updated?.on_hold_reason === "string"
                  ? updated.on_hold_reason
                  : previous.on_hold_reason,
              updated_at:
                typeof updated?.updated_at === "string" ? updated.updated_at : previous.updated_at,
            }
          : previous,
      )
      toast({ title: "On-hold request approved", variant: "success" })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve on-hold request."
      toast({ title: "Unable to approve request", description: message, variant: "destructive" })
    } finally {
      setIsStatusChanging(false)
    }
  }

  const handleCancel = async (reason: string) => {
    setIsStatusChanging(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled", cancelled_reason: reason }),
        },
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.details?.message ?? data.error?.message ?? "Failed to cancel")
      }
      toast({
        title: "Work order cancelled",
        variant: "success",
      })
      setIsCancelDialogOpen(false)
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel."
      toast({ title: "Unable to cancel", description: message, variant: "destructive" })
    } finally {
      setIsStatusChanging(false)
    }
  }

  const handleResume = async () => {
    if (!task || task.status !== "on_hold") return
    setIsStatusChanging(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_progress" }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to resume")
      }
      const updated = payload?.data?.maintenanceTask as Partial<TaskDetails> | undefined
      setTask((previous) =>
        previous
          ? {
              ...previous,
              status:
                updated?.status === "in_progress_vendor" || updated?.status === "in_progress"
                  ? updated.status
                  : "in_progress",
              started_at:
                typeof updated?.started_at === "string" ? updated.started_at : previous.started_at,
              on_hold_at: null,
              on_hold_reason: null,
              updated_at:
                typeof updated?.updated_at === "string" ? updated.updated_at : previous.updated_at,
            }
          : previous,
      )
      setNow(Date.now())
      toast({ title: "Work order resumed" })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resume."
      toast({ title: "Unable to resume", description: message, variant: "destructive" })
    } finally {
      setIsStatusChanging(false)
    }
  }

  const handleReassignTask = async (staffId: string) => {
    setIsReassigning(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staffId }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to reassign."
        throw new Error(message)
      }
      toast({
        title: "Work order reassigned",
        variant: "success",
      })
      mutate()
    } finally {
      setIsReassigning(false)
    }
  }

  const handleAssignVendor = async (vendorId: string) => {
    if (!task || isAssigningVendor) return
    setIsAssigningVendor(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_progress_vendor", vendorId }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to assign to vendor."
        throw new Error(message)
      }
      toast({ title: "Assigned to vendor", variant: "success" })
      setIsVendorDialogOpen(false)
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to assign to vendor."
      toast({ title: "Unable to assign", description: message, variant: "destructive" })
    } finally {
      setIsAssigningVendor(false)
    }
  }

  const handleCompleteFromVendor = async () => {
    if (!task || isCompletingVendor) return
    if (!vendorInvoiceNumber.trim() || !vendorInvoiceCost || !closeoutNotes.trim()) {
      toast({
        title: "Missing closeout fields",
        description: "Please fill in all vendor closeout fields before completing.",
        variant: "destructive",
      })
      return
    }
    setIsCompletingVendor(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            vendorInvoiceNumber: vendorInvoiceNumber.trim(),
            vendorInvoiceCost: Number(vendorInvoiceCost),
            closeoutNotes: closeoutNotes.trim(),
          }),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to complete work order."
        throw new Error(message)
      }
      toast({ title: "Work order completed", variant: "success" })
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete work order."
      toast({ title: "Unable to complete", description: message, variant: "destructive" })
    } finally {
      setIsCompletingVendor(false)
    }
  }

  const handleSaveCosts = async () => {
    if (!task || isSavingCosts) return
    setIsSavingCosts(true)
    try {
      const patchBody: Record<string, unknown> = {}
      if (editLaborCost !== "") {
        patchBody.actualLaborCost = Number(editLaborCost)
      }
      if (editPartsCost !== "") {
        patchBody.actualPartsCost = Number(editPartsCost)
      }
      if (Object.keys(patchBody).length === 0) return

      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${maintenanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        },
      )
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to save costs."
        throw new Error(message)
      }
      toast({ title: "Costs saved", variant: "success" })
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save costs."
      toast({ title: "Unable to save costs", description: message, variant: "destructive" })
    } finally {
      setIsSavingCosts(false)
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading maintenance task…
        </div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {error ?? "Task not found."}
      </div>
    )
  }

  const siteLabel = task.site?.site_name?.trim() || task.site?.site_number || "Unknown site"
  const assigneeLabel = task.staff_id
    ? assigneeLabelById.get(task.staff_id) ?? "Assigned"
    : task.vendor_id
      ? "Vendor Assigned"
      : "Unassigned"
  const isCancelled = task.status === "cancelled"
  const workOrderLabel = task.wo_number ?? `WO-${task.id.slice(0, 4).toUpperCase()}`
  const totalEstimated = (task.estimated_labor_cost ?? 0) + (task.estimated_parts_cost ?? 0)
  const totalActual = (task.actual_labor_cost ?? 0) + (task.actual_parts_cost ?? 0)
  const hasActualCosts = task.actual_labor_cost != null || task.actual_parts_cost != null
  const costVariance = totalActual - totalEstimated
  const canEditCosts = canEnterLaborCost && ["in_progress", "in_progress_vendor", "completed"].includes(task.status)
  const costHasChanges =
    editLaborCost !== String(task.actual_labor_cost ?? "") ||
    editPartsCost !== String(task.actual_parts_cost ?? "")
  const slaTargetHours = task.sla ?? null
  const slaProgressPercent =
    slaTargetHours && slaSecondsRemaining !== null
      ? Math.max(
          0,
          Math.min(
            100,
            ((slaTargetHours * 3600 - slaSecondsRemaining) / (slaTargetHours * 3600)) * 100,
          ),
        )
      : null

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link
        href={`/dashboard/${propertyId}/maintenance`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <section className="overflow-hidden rounded-xl border border-border">
        <div className={`px-4 py-4 text-white sm:px-6 transition-colors duration-300 ${isSlaBreached ? "bg-red-900" : "bg-emerald-950"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-100/80">
                {workOrderLabel} · {siteLabel}
              </p>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight">{task.title}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusBadgeClass(task.status)}>
                  {statusLabel(task.status)}
                </Badge>
                <Badge variant="outline" className={priorityBadgeClass(task.priority)}>
                  {priorityLabel(task.priority)}
                </Badge>
                <Badge variant="outline" className="border-emerald-400/30 bg-emerald-900/40 text-emerald-100">
                  {assigneeLabel}
                </Badge>
                {task.is_suspected_damage && (
                  <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-800">
                    ⚠ Suspected Damage
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">SLA</p>
              <p className={`text-3xl font-semibold ${isSlaBreached ? "text-red-300" : ""}`}>{slaDisplay ?? "—"}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-100/80">
                <Clock className="h-3.5 w-3.5" />
                Work timer: {workTimerDisplay}
              </p>
            </div>
          </div>
        </div>

        {!isCancelled ? (
          <div className="border-t bg-card px-3 py-4 sm:px-6">
            <div className="flex items-center justify-center gap-1">
              {stepperSteps.map((step, index) => {
                const isActive = index === activeStepIndex
                const isPast = index < activeStepIndex
                return (
                  <div key={step.label} className="flex items-center gap-1">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium border transition-colors ${
                          isActive
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : isPast
                              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                              : "border-border bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {isPast ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </div>
                      <span
                        className={`text-[11px] whitespace-nowrap ${
                          isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {index < stepperSteps.length - 1 ? (
                      <div
                        className={`mx-2 h-0.5 w-8 sm:w-16 ${
                          index < activeStepIndex ? "bg-emerald-400" : "bg-border"
                        }`}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </section>

        {/* ── Action buttons ── */}
        {canEditTask || showHold || showApproveHold || showResume || showCancel || showReassign || showAssignVendor || showCloseout ? (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
            {showStart ? (
              <Button
                type="button"
                className="col-span-1 gap-2 sm:w-auto"
                disabled={isStarting}
                onClick={() => void handleStart()}
              >
                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start
              </Button>
            ) : null}
            {showComplete ? (
              <Button
                type="button"
                className="col-span-1 gap-2 sm:w-auto"
                disabled={isCompleting}
                onClick={() => void handleComplete()}
              >
                {isCompleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Complete
              </Button>
            ) : null}
            {showHold ? (
              <Button
                type="button"
                variant="outline"
                className="col-span-1 gap-2 sm:w-auto"
                disabled={isStatusChanging}
                onClick={() => setIsHoldDialogOpen(true)}
              >
                <Pause className="h-4 w-4" />
                {canResume ? "Put On Hold" : "Request On Hold"}
              </Button>
            ) : null}
            {showApproveHold ? (
              <Button
                type="button"
                variant="outline"
                className="col-span-1 gap-2 sm:w-auto"
                disabled={isStatusChanging}
                onClick={() => void handleApproveOnHold()}
              >
                {isStatusChanging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve On Hold
              </Button>
            ) : null}
            {showResume ? (
              <Button
                type="button"
                variant="outline"
                className="col-span-1 gap-2 sm:w-auto"
                disabled={isStatusChanging}
                onClick={() => void handleResume()}
              >
                {isStatusChanging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Resume
              </Button>
            ) : null}
            {showReopen ? (
              <Button
                type="button"
                variant="outline"
                className="col-span-1 gap-2 sm:w-auto"
                disabled={isReopening}
                onClick={() => void handleReopen()}
              >
                {isReopening ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Reopen
              </Button>
            ) : null}
            {showCancel ? (
              <Button
                type="button"
                variant="outline"
                className="col-span-1 gap-2 sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={isStatusChanging}
                onClick={() => setIsCancelDialogOpen(true)}
              >
                <Ban className="h-4 w-4" />
                Cancel
              </Button>
            ) : null}
            {showReassign ? (
              <Button
                type="button"
                variant="outline"
                className="col-span-2 gap-2 sm:w-auto"
                onClick={() => setIsReassignOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Reassign
              </Button>
            ) : null}
            {showAssignVendor ? (
              <Button
                type="button"
                variant="outline"
                className="col-span-1 gap-2 sm:w-auto"
                disabled={isAssigningVendor}
                onClick={() => setIsVendorDialogOpen(true)}
              >
                {isAssigningVendor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Assign to Vendor
              </Button>
            ) : null}
            {showCloseout ? (
              <Button
                type="button"
                className="col-span-2 gap-2 sm:w-auto"
                disabled={isCompletingVendor || !vendorInvoiceNumber.trim() || !vendorInvoiceCost || !closeoutNotes.trim()}
                onClick={() => void handleCompleteFromVendor()}
              >
                {isCompletingVendor ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Complete (Vendor Closeout)
              </Button>
            ) : null}
          </div>
        ) : null}
      

      {/* ── Main content grid ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Work Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-0 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="font-semibold">{propertyName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Site / Cabin</p>
                  <p className="font-semibold">
                    {siteLabel}
                    {task.site?.site_type ? ` (${task.site.site_type})` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-semibold">{task.category ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="font-semibold">
                    {task.source ? task.source.charAt(0).toUpperCase() + task.source.slice(1) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled Start</p>
                  <p className="font-semibold">{task.scheduled_start ? formatDateTime(task.scheduled_start) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-semibold">{task.due_date ? formatDateTime(task.due_date) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Started At</p>
                  <p className="font-semibold">{task.started_at ? formatDateTime(task.started_at) : "—"}</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="mb-1 text-xs text-muted-foreground">Description</p>
                <p className="text-sm whitespace-pre-wrap">{task.description?.trim() || "No description provided."}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Photos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {taskImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {taskImages.map((image) => (
                    <div key={image.id} className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted/20">
                      <Image
                        src={createClient().storage.from(TASK_IMAGES_BUCKET).getPublicUrl(image.storagePath).data.publicUrl}
                        alt="Maintenance task photo"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex aspect-[8/2] items-center justify-center rounded-md border border-dashed bg-muted/20 text-xs text-muted-foreground">
                  No photos uploaded yet
                </div>
              )}
            </CardContent>
          </Card>

          {showCloseout && (
            <Card className="border-violet-200 bg-violet-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Vendor Closeout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0 text-sm">
                <p className="text-muted-foreground">Complete all fields below before marking this work order as completed.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="vendor-invoice-number">Vendor Invoice Number *</Label>
                    <Input
                      id="vendor-invoice-number"
                      value={vendorInvoiceNumber}
                      onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-2026-0042"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vendor-invoice-cost">Vendor Invoice Cost *</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="vendor-invoice-cost"
                        type="number"
                        min={0}
                        step={1}
                        value={vendorInvoiceCost}
                        onChange={(e) => setVendorInvoiceCost(e.target.value)}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="closeout-notes">Resolution Notes *</Label>
                  <Textarea
                    id="closeout-notes"
                    value={closeoutNotes}
                    onChange={(e) => setCloseoutNotes(e.target.value)}
                    placeholder="Describe the work performed and resolution details"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {task.vendor_invoice_number && task.status === "completed" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Vendor Closeout Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Number</span>
                  <span className="font-semibold">{task.vendor_invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Cost</span>
                  <span className="font-semibold">{formatCurrency(task.vendor_invoice_cost)}</span>
                </div>
                {task.closeout_notes && (
                  <div className="border-t pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Resolution Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{task.closeout_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <PermissionGate permission="maintenance.enter_labor_cost" fallback={null}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Cost Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0 text-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Estimated Labor</span>
                    <span className="font-semibold">{formatCurrency(task.estimated_labor_cost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Estimated Parts</span>
                    <span className="font-semibold">{formatCurrency(task.estimated_parts_cost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Actual Labor</span>
                    {canEditCosts ? (
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          type="number"
                          placeholder="—"
                          className="h-7 w-28 pl-5 text-right text-sm"
                          min={0}
                          step={1}
                          value={editLaborCost}
                          onChange={(e) => setEditLaborCost(e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="font-semibold">{formatCurrency(task.actual_labor_cost)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Actual Parts</span>
                    {canEditCosts ? (
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          type="number"
                          placeholder="—"
                          className="h-7 w-28 pl-5 text-right text-sm"
                          min={0}
                          step={1}
                          value={editPartsCost}
                          onChange={(e) => setEditPartsCost(e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="font-semibold">{formatCurrency(task.actual_parts_cost)}</span>
                    )}
                  </div>
                </div>
                {canEditCosts && costHasChanges && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={isSavingCosts}
                      onClick={() => void handleSaveCosts()}
                    >
                      {isSavingCosts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Costs
                    </Button>
                  </div>
                )}
                <div className="grid gap-4 border-t pt-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Total</p>
                    <p className="text-3xl font-bold">{formatCurrency(totalEstimated)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Actual Total</p>
                    <p className="text-3xl font-bold">{hasActualCosts ? formatCurrency(totalActual) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Variance</p>
                    <p className={`text-3xl font-bold ${hasActualCosts ? (costVariance <= 0 ? "text-emerald-700" : "text-red-600") : "text-muted-foreground"}`}>
                      {hasActualCosts
                        ? `${costVariance < 0 ? "" : "+"}$${costVariance.toFixed(2)}`
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PermissionGate>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {activityEntries.map((entry) => (
                  <div key={entry.id} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    <p className="text-xs text-muted-foreground">{formatDateTime(entry.timestamp)}</p>
                    <p className="font-semibold">{entry.label}</p>
                    {entry.detail ? <p className="text-xs text-muted-foreground">{entry.detail}</p> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">SLA Timer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Response SLA</span>
                <span>{slaTargetHours ? `${slaTargetHours}h target` : "No SLA"}</span>
              </div>
              {task.due_date ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{formatDateTime(task.due_date)}</span>
                </div>
              ) : null}
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full transition-all ${isSlaBreached ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${slaProgressPercent ?? 0}%` }} />
              </div>
              <div className={`rounded-md px-3 py-2 text-sm ${isSlaBreached ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                {slaSecondsRemaining === null ? "No active SLA" : isSlaBreached ? "SLA Breached" : "On track"}
              </div>
              {task.on_hold_reason ? (
                <div className="space-y-1 border-t pt-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hold Reason</p>
                  <p className="text-sm text-amber-700">{task.on_hold_reason}</p>
                </div>
              ) : null}
              {task.cancelled_reason ? (
                <div className="space-y-1 border-t pt-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cancellation Reason</p>
                  <p className="text-sm text-red-700">{task.cancelled_reason}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <StatusChangeReasonDialog
        open={isHoldDialogOpen}
        onOpenChange={setIsHoldDialogOpen}
        title={canResume ? "Put Work Order On Hold" : "Request On Hold"}
        description={
          canResume
            ? "Please provide a reason for putting this work order on hold."
            : "Please provide a reason for requesting this work order to be put on hold."
        }
        onSubmit={canResume ? handlePutOnHold : handleRequestOnHold}
        isSubmitting={isStatusChanging}
      />
      <StatusChangeReasonDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        title="Cancel Work Order"
        description="Please provide a reason for cancelling this work order. This action can be undone by reopening."
        onSubmit={handleCancel}
        isSubmitting={isStatusChanging}
      />
      <ReassignTaskDialog
        open={showReassign && isReassignOpen}
        onOpenChange={setIsReassignOpen}
        userOptions={assigneeOptions}
        currentUserId={task.staff_id}
        isSubmitting={isReassigning}
        onSubmit={handleReassignTask}
      />
      <AssignVendorDialog
        open={isVendorDialogOpen}
        onOpenChange={setIsVendorDialogOpen}
        propertyId={propertyId}
        isSubmitting={isAssigningVendor}
        onSubmit={handleAssignVendor}
      />
    </div>
  )
}
