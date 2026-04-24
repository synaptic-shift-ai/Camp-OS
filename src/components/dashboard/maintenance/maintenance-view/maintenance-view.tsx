"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  SlidersHorizontal,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import { StatusChangeReasonDialog } from "../maintenance-dialog/status-change-reason-dialog"
import { ReassignTaskDialog } from "../../housekeeping/housekeeping-dialog.tsx/reassign-task-dialog"

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
}

type TaskDetails = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string | null
  category: string | null
  source: string | null
  estimated_labor_cost: number | null
  estimated_parts_cost: number | null
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
  if (status === "on_hold") return "On Hold"
  if (status === "completed") return "Completed"
  if (status === "cancelled") return "Cancelled"
  return "Open"
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700"
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

const STEPS: StepDef[] = [
  { label: "Open", apiStatuses: ["open"] },
  { label: "In Progress", apiStatuses: ["in_progress"] },
  { label: "On Hold", apiStatuses: ["on_hold"] },
  { label: "Complete", apiStatuses: ["completed"] },
]

type ActivityEntry = {
  id: string
  label: string
  detail: string | null
  timestamp: string
}

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
        title: raw.title,
        description: raw.description,
        status: raw.status,
        priority: raw.priority,
        category: raw.category,
        source: raw.source,
        estimated_labor_cost: raw.estimatedLaborCost ?? raw.estimated_labor_cost ?? null,
        estimated_parts_cost: raw.estimatedPartsCost ?? raw.estimated_parts_cost ?? null,
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

  // ── Live timer for in-progress tasks ──

  useEffect(() => {
    if (task?.status === "in_progress") {
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
    const endMs = task.completed_at ? new Date(task.completed_at).getTime() : now
    return Math.max(0, Math.floor((endMs - startMs) / 1000))
  }, [task?.started_at, task?.completed_at, now])

  const workTimerDisplay = useMemo(() => {
    if (workElapsedSeconds === null) return "Not started"
    return formatDuration(workElapsedSeconds)
  }, [workElapsedSeconds])

  // ── SLA timer ──

  const slaSecondsRemaining = useMemo(() => {
    if (!task?.sla || !task?.created_at) return null
    const createdMs = new Date(task.created_at).getTime()
    const deadlineMs = createdMs + task.sla * 3600 * 1000
    const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000))
    if (task.status === "completed" || task.status === "cancelled") return null
    return remaining
  }, [task?.sla, task?.created_at, task?.status, now])

  const slaDisplay = useMemo(() => {
    if (slaSecondsRemaining === null) return null
    return formatDuration(slaSecondsRemaining)
  }, [slaSecondsRemaining])

  // ── Stepper ──

  const activeStepIndex = useMemo(() => {
    if (!task) return 0
    return STEPS.findIndex((step) => step.apiStatuses.includes(task.status))
  }, [task])

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
  const showHold = canHold && task?.status === "in_progress"
  const showResume = canResume && task?.status === "on_hold"
  const showCancel = canCancel && ["open", "in_progress", "on_hold"].includes(task?.status ?? "")
  const showReassign = canAssignWo && !["completed", "cancelled"].includes(task?.status ?? "")

  // ── Handlers ──

  const mutate = useCallback(() => {
    void loadTask()
  }, [loadTask])

  const handleStart = async () => {
    if (!task || task.status !== "open" || isStarting) return
    setIsStarting(true)
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
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to start work order."
        throw new Error(message)
      }
      toast({ title: "Work order started" })
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start work order."
      toast({ title: "Unable to start", description: message, variant: "destructive" })
    } finally {
      setIsStarting(false)
    }
  }

  const handleComplete = async () => {
    if (!task || task.status !== "in_progress" || isCompleting) return
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
      toast({ title: "Work order completed" })
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

  const handlePutOnHold = async (reason: string) => {
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
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.details?.message ?? data.error?.message ?? "Failed to put on hold")
      }
      toast({ title: "Work order put on hold" })
      setIsHoldDialogOpen(false)
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to put on hold."
      toast({ title: "Unable to hold", description: message, variant: "destructive" })
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
      toast({ title: "Work order cancelled" })
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
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.details?.message ?? data.error?.message ?? "Failed to resume")
      }
      toast({ title: "Work order resumed" })
      mutate()
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
      toast({ title: "Work order reassigned" })
      mutate()
    } finally {
      setIsReassigning(false)
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
  const assigneeLabel = task.staff_id ? assigneeLabelById.get(task.staff_id) ?? "Assigned" : "Unassigned"
  const isCancelled = task.status === "cancelled"

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <Link
            href={`/dashboard/${propertyId}/maintenance`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {task.id.slice(0, 8)} · {propertyName}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusBadgeClass(task.status)}>
                {statusLabel(task.status)}
              </Badge>
              <Badge variant="outline" className={priorityBadgeClass(task.priority)}>
                {priorityLabel(task.priority)}
              </Badge>
              {task.category ? (
                <span className="text-sm text-muted-foreground">{task.category}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        {canEditTask || showHold || showResume || showCancel || showReassign ? (
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
                Put On Hold
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
          </div>
        ) : null}
      </div>

      {/* ── Stepper ── */}
      {isCancelled ? null : (
        <div className="flex items-center justify-center gap-1 rounded-lg border bg-card p-4">
          {STEPS.map((step, index) => {
            const isActive = index === activeStepIndex
            const isPast = index < activeStepIndex
            return (
              <div key={step.label} className="flex items-center gap-1">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium border transition-colors ${
                      isActive
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : isPast
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-border bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </div>
                  <span
                    className={`text-[11px] whitespace-nowrap ${
                      isActive ? "font-medium text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 ? (
                  <div
                    className={`mx-2 h-0.5 w-8 sm:w-12 ${
                      index < activeStepIndex ? "bg-emerald-300" : "bg-border"
                    }`}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Main content grid ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* ── Details card ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Site</span>
                <span className="font-medium">{siteLabel}</span>
              </div>
              {task.description?.trim() ? (
                <div className="space-y-1 border-t pt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{task.description.trim()}</p>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Assignee</span>
                <span>{assigneeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Source</span>
                <span>{task.source ? task.source.charAt(0).toUpperCase() + task.source.slice(1) : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(task.created_at)}</span>
              </div>

              <PermissionGate permission="maintenance.enter_labor_cost" fallback={null}>
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cost Estimate</p>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Labor</span>
                      <span>{formatCurrency(task.estimated_labor_cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Parts</span>
                      <span>{formatCurrency(task.estimated_parts_cost)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Total</span>
                      <span>
                        {formatCurrency(
                          (task.estimated_labor_cost ?? 0) + (task.estimated_parts_cost ?? 0),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </PermissionGate>

              {/* Hold/Cancel reason display */}
              {task.on_hold_reason ? (
                <div className="space-y-1 border-t pt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hold Reason</p>
                  <p className="text-sm text-amber-700">{task.on_hold_reason}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(task.on_hold_at)}</p>
                </div>
              ) : null}
              {task.cancelled_reason ? (
                <div className="space-y-1 border-t pt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cancellation Reason</p>
                  <p className="text-sm text-red-700">{task.cancelled_reason}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(task.cancelled_at)}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* ── Timers card ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Time Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Work Time</span>
                <span className="font-mono font-medium">{workTimerDisplay}</span>
              </div>
              {slaDisplay !== null ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">SLA Remaining</span>
                  <span
                    className={`font-mono font-medium ${
                      slaSecondsRemaining !== null && slaSecondsRemaining < 3600
                        ? "text-red-600"
                        : "text-foreground"
                    }`}
                  >
                    {slaDisplay}
                  </span>
                </div>
              ) : null}
              {task.sla ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">SLA (hrs)</span>
                  <span>{task.sla}h</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* ── Activity card ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0 text-sm">
              {activityEntries.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-0.5">
                  <p className="font-medium text-foreground">{entry.label}</p>
                  {entry.detail ? (
                    <p className="text-muted-foreground">{entry.detail}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{formatDateTime(entry.timestamp)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <StatusChangeReasonDialog
        open={isHoldDialogOpen}
        onOpenChange={setIsHoldDialogOpen}
        title="Put on Hold"
        description="Please provide a reason for putting this work order on hold."
        onSubmit={handlePutOnHold}
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
    </div>
  )
}
