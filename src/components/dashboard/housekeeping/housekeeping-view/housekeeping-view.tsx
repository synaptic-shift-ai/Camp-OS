"use client"

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, CheckCircle2, ListChecks, Loader2, Play, SlidersHorizontal, Upload, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/contracts/db"
import { parseChecklistTemplateLines } from "@/lib/dashboard/housekeeping/housekeeping-queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { ReassignTaskDialog } from "../housekeeping-dialog.tsx/reassign-task-dialog"

type AssigneeOption = {
  id: string
  label: string
}

type HousekeepingViewProps = {
  propertyId: string
  propertyName: string
  housekeepingId: string
  assigneeOptions: AssigneeOption[]
  canEditTask: boolean
}

type TaskDetails = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string | null
  created_at: string
  updated_at: string
  start_date: string | null
  start_at: string | null
  end_date: string | null
  checklist_item_done: Json
  site: { site_name: string | null; site_number: string | null } | null
  reservation: { confirmation_number: string | null } | null
  checklist: { name: string | null; item: Json } | null
  staff_id: string | null
}

type ChecklistDoneEntry = {
  item_id: string
  status: "pending" | "completed"
  completed_at?: string | null | undefined
}

type ChecklistImageItem = {
  id: string
  storagePath: string
}

type UploadingImageItem = {
  id: string
  name: string
  previewUrl: string
  file: File
}

const TASK_IMAGES_BUCKET = "maintenance-and-housekeeping-images"

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
  if (status === "done") return "Completed"
  return "Pending"
}

function priorityLabel(priority: string | null): string {
  if (priority === "urgent") return "Urgent"
  if (priority === "high") return "High"
  if (priority === "low") return "Low"
  return "Medium"
}

function statusBadgeClass(status: string): string {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "in_progress") return "border-sky-200 bg-sky-50 text-sky-700"
  return "border-zinc-200 bg-zinc-50 text-zinc-700"
}

function priorityBadgeClass(priority: string | null): string {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-700"
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-700"
  if (priority === "low") return "border-zinc-200 bg-zinc-50 text-zinc-700"
  return "border-blue-200 bg-blue-50 text-blue-700"
}

function getDoneEntries(raw: Json): ChecklistDoneEntry[] {
  if (!Array.isArray(raw)) return []
  const parsedEntries = raw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null
      const record = entry as Record<string, unknown>
      if (typeof record.item_id !== "string") return null
      if (record.status !== "pending" && record.status !== "completed") return null
      const status = record.status as "pending" | "completed"
      const completedAt =
        typeof record.completed_at === "string" && record.completed_at.trim().length > 0
          ? record.completed_at
          : null
      return {
        item_id: record.item_id,
        status,
        completed_at: completedAt,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  return parsedEntries
}

export function HousekeepingView({
  propertyId,
  propertyName,
  housekeepingId,
  assigneeOptions,
  canEditTask,
}: HousekeepingViewProps) {
  const { toast } = useToast()
  const [task, setTask] = useState<TaskDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdatingChecklist, setIsUpdatingChecklist] = useState(false)
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [isReassigning, setIsReassigning] = useState(false)
  const [checklistDoneIds, setChecklistDoneIds] = useState<Set<string>>(new Set())
  const [checklistCompletedAtById, setChecklistCompletedAtById] = useState<Map<string, string>>(new Map())
  const [checklistImages, setChecklistImages] = useState<ChecklistImageItem[]>([])
  const [uploadingImages, setUploadingImages] = useState<UploadingImageItem[]>([])
  const [deletingImageIds, setDeletingImageIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [isStartingTask, setIsStartingTask] = useState(false)
  const [isCompletingTask, setIsCompletingTask] = useState(false)

  const loadTask = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: loadError } = await supabase
        .from("housekeeping_tasks")
        .select(
          `
          id,
          title,
          description,
          status,
          priority,
          created_at,
          updated_at,
          start_date,
          start_at,
          end_date,
          checklist_item_done,
          staff_id,
          site:sites(site_name, site_number),
          reservation:reservations(confirmation_number),
          checklist:checklist(name, item)
        `,
        )
        .eq("id", housekeepingId)
        .eq("property_id", propertyId)
        .maybeSingle()

      if (loadError) throw new Error(loadError.message)
      if (!data) throw new Error("Task not found.")

      setTask(data as unknown as TaskDetails)
    } catch (loadTaskError) {
      const message =
        loadTaskError instanceof Error ? loadTaskError.message : "Failed to load housekeeping task."
      setError(message)
      setTask(null)
    } finally {
      setLoading(false)
    }
  }, [housekeepingId, propertyId])

  useEffect(() => {
    void loadTask()
  }, [loadTask])

  const checklistItems = useMemo(
    () => parseChecklistTemplateLines(task?.checklist?.item ?? null),
    [task?.checklist?.item],
  )

  useEffect(() => {
    const entries = getDoneEntries(task?.checklist_item_done ?? null)
    setChecklistDoneIds(
      new Set(entries.filter((entry) => entry.status === "completed").map((entry) => entry.item_id)),
    )
    setChecklistCompletedAtById(
      new Map(
        entries
          .filter((entry) => entry.status === "completed" && Boolean(entry.completed_at))
          .map((entry) => [entry.item_id, entry.completed_at as string]),
      ),
    )
  }, [task?.checklist_item_done])

  const loadTaskImages = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/housekeeping/${housekeepingId}/images`,
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message = payload?.error?.message ?? 'Failed to load task images.'
        throw new Error(message)
      }
      const images = Array.isArray(payload?.data?.images)
        ? payload.data.images.map((row: { id: string; storage_path: string }) => ({
            id: row.id,
            storagePath: row.storage_path,
          }))
        : []
      setChecklistImages(images)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load task images.'
      toast({
        title: 'Unable to load images',
        description: message,
        variant: 'destructive',
      })
    }
  }, [housekeepingId, propertyId, toast])

  useEffect(() => {
    void loadTaskImages()
  }, [loadTaskImages])

  const completionPercent = useMemo(() => {
    if (checklistItems.length === 0) return 0
    const completed = checklistItems.filter((item) => item.id && checklistDoneIds.has(item.id)).length
    return Math.round((completed / checklistItems.length) * 100)
  }, [checklistItems, checklistDoneIds])
  const assigneeLabelById = useMemo(
    () => new Map(assigneeOptions.map((option) => [option.id, option.label])),
    [assigneeOptions],
  )

  const persistChecklist = async (
    nextDoneIds: Set<string>,
    nextCompletedAtById: Map<string, string>,
  ) => {
    if (!task) return
    const nextEntries: ChecklistDoneEntry[] = checklistItems
      .filter((item): item is { id: string; label: string; notes: string | null } => Boolean(item.id))
      .map((item) => ({
        item_id: item.id,
        status: nextDoneIds.has(item.id) ? "completed" : "pending",
        completed_at: nextDoneIds.has(item.id) ? (nextCompletedAtById.get(item.id) ?? null) : null,
      }))

    setIsUpdatingChecklist(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/housekeeping/${housekeepingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistItemDone: nextEntries }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to update checklist."
        throw new Error(message)
      }
      setTask((previousTask) =>
        previousTask
          ? {
              ...previousTask,
              checklist_item_done: nextEntries as unknown as Json,
              updated_at: payload?.data?.housekeepingTask?.updated_at ?? previousTask.updated_at,
            }
          : previousTask,
      )
    } finally {
      setIsUpdatingChecklist(false)
    }
  }

  const handleToggleChecklist = async (itemId: string, checked: boolean) => {
    const previousDoneIds = new Set(checklistDoneIds)
    const previousCompletedAtById = new Map(checklistCompletedAtById)
    const nextDoneIds = new Set(checklistDoneIds)
    const nextCompletedAtById = new Map(checklistCompletedAtById)
    if (checked) {
      nextDoneIds.add(itemId)
      if (!nextCompletedAtById.has(itemId)) {
        nextCompletedAtById.set(itemId, new Date().toISOString())
      }
    } else {
      nextDoneIds.delete(itemId)
      nextCompletedAtById.delete(itemId)
    }
    setChecklistDoneIds(nextDoneIds)
    setChecklistCompletedAtById(nextCompletedAtById)

    try {
      await persistChecklist(nextDoneIds, nextCompletedAtById)
    } catch (persistError) {
      setChecklistDoneIds(previousDoneIds)
      setChecklistCompletedAtById(previousCompletedAtById)
      const message =
        persistError instanceof Error ? persistError.message : "Failed to save checklist update."
      toast({
        title: "Unable to update checklist",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleReassignTask = async (staffId: string) => {
    setIsReassigning(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/housekeeping/${housekeepingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to reassign task."
        throw new Error(message)
      }
      toast({
        title: "Task reassigned",
        description: "The assignee has been updated.",
      })
      await loadTask()
    } finally {
      setIsReassigning(false)
    }
  }

  const handleMarkAsComplete = async () => {
    if (!task || isCompletingTask) return

    const hasChecklistRows = checklistItems.length > 0
    const allChecklistDone = checklistItems.every(
      (item) => !item.id || checklistDoneIds.has(item.id),
    )

    if (hasChecklistRows && !allChecklistDone) {
      toast({
        title: "Checklist not complete",
        description: "Finish every checklist item before marking this task complete.",
        variant: "destructive",
      })
      return
    }

    if (checklistImages.length === 0) {
      toast({
        title: "Photo required",
        description: "Attach at least one image before marking this task complete.",
        variant: "destructive",
      })
      return
    }

    setIsCompletingTask(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/housekeeping/${housekeepingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to complete task."
        throw new Error(message)
      }

      setTask((previous) =>
        previous
          ? {
              ...previous,
              status: "done",
              updated_at: payload?.data?.housekeepingTask?.updated_at ?? previous.updated_at,
            }
          : previous,
      )
      toast({
        title: "Task completed",
        description: "The housekeeping task is now marked as done.",
      })
    } catch (completeError) {
      const message =
        completeError instanceof Error ? completeError.message : "Failed to complete housekeeping task."
      toast({
        title: "Unable to complete task",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsCompletingTask(false)
    }
  }

  const handleStartTask = async () => {
    if (!task || task.status !== "pending" || isStartingTask) return

    setIsStartingTask(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/housekeeping/${housekeepingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress", startAt: new Date().toISOString() }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message = payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to start task."
        throw new Error(message)
      }

      setTask((previous) =>
        previous
          ? {
              ...previous,
              status: "in_progress",
              start_at: payload?.data?.housekeepingTask?.start_at ?? new Date().toISOString(),
              updated_at: payload?.data?.housekeepingTask?.updated_at ?? previous.updated_at,
            }
          : previous,
      )
      toast({
        title: "Task started",
        description: "The housekeeping task is now in progress.",
      })
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "Failed to start housekeeping task."
      toast({
        title: "Unable to start task",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsStartingTask(false)
    }
  }

  const handleSelectImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (selectedFiles.length === 0) return

    const maxSizeBytes = 8 * 1024 * 1024
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"))
    const oversizedFiles = imageFiles.filter((file) => file.size > maxSizeBytes)
    if (oversizedFiles.length > 0) {
      toast({
        title: "Some files were skipped",
        description: "Each image must be 8MB or smaller.",
        variant: "destructive",
      })
    }

    const validFiles = imageFiles.filter((file) => file.size <= maxSizeBytes)
    const sanitizeFileName = (name: string) =>
      name
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .toLowerCase()
    const bucket = TASK_IMAGES_BUCKET

    setIsUploadingImages(true)
    const pendingUploads: UploadingImageItem[] = validFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      file,
    }))
    setUploadingImages((prev) => [...prev, ...pendingUploads])
    try {
      console.info("[HousekeepingView] Starting image upload batch", {
        propertyId,
        housekeepingId,
        selectedFileCount: selectedFiles.length,
        validFileCount: validFiles.length,
      })
      for (const pending of pendingUploads) {
        const file = pending.file
        const safeName = sanitizeFileName(file.name) || 'image'
        const storagePath = `property/${propertyId}/housekeeping/${housekeepingId}/${crypto.randomUUID()}-${safeName}`
        console.info("[HousekeepingView] Uploading file to storage", {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath,
          bucket,
        })

        const supabase = createClient()
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, {
            upsert: false,
            contentType: file.type,
          })
        if (uploadError) {
          console.error("[HousekeepingView] Storage upload failed", {
            fileName: file.name,
            storagePath,
            message: uploadError.message,
          })
          throw new Error(uploadError.message)
        }
        console.info("[HousekeepingView] Storage upload succeeded", {
          fileName: file.name,
          storagePath,
        })

        const registerResponse = await fetch(
          `/api/v1/properties/${propertyId}/housekeeping/${housekeepingId}/images`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storagePath }),
          },
        )
        const registerPayload = await registerResponse.json()
        if (!registerResponse.ok || !registerPayload?.success) {
          const message = registerPayload?.error?.message ?? 'Failed to save uploaded image.'
          console.error("[HousekeepingView] Register image API failed", {
            fileName: file.name,
            storagePath,
            status: registerResponse.status,
            payload: registerPayload,
          })
          throw new Error(message)
        }
        console.info("[HousekeepingView] Image registration succeeded", {
          fileName: file.name,
          storagePath,
          imageId: registerPayload?.data?.image?.id,
        })

        URL.revokeObjectURL(pending.previewUrl)
        setUploadingImages((prev) => prev.filter((item) => item.id !== pending.id))
      }
      await loadTaskImages()
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Failed to upload image.'
      console.error("[HousekeepingView] Upload batch failed", {
        propertyId,
        housekeepingId,
        message,
        uploadError,
      })
      toast({
        title: 'Image upload failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setUploadingImages((prev) => {
        for (const pending of prev) {
          URL.revokeObjectURL(pending.previewUrl)
        }
        return []
      })
      event.target.value = ''
      setIsUploadingImages(false)
    }
  }

  const handleRemoveImage = (imageId: string) => {
    void (async () => {
      setDeletingImageIds((prev) => new Set(prev).add(imageId))
      try {
        const response = await fetch(
          `/api/v1/properties/${propertyId}/housekeeping/${housekeepingId}/images/${imageId}`,
          {
            method: 'DELETE',
          },
        )
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          const message = payload?.error?.message ?? 'Failed to delete image.'
          throw new Error(message)
        }
        setChecklistImages((previous) => previous.filter((image) => image.id !== imageId))
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : 'Failed to delete image.'
        toast({
          title: 'Unable to delete image',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setDeletingImageIds((prev) => {
          const next = new Set(prev)
          next.delete(imageId)
          return next
        })
      }
    })()
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading housekeeping task…
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
  const showStartTaskAction = task.status === "pending"
  const showMarkCompleteAction = task.status !== "done"

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <Link
            href={`/dashboard/${propertyId}/housekeeping`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {task.id.slice(0, 8)} · {propertyName}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{siteLabel}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusBadgeClass(task.status)}>
                {statusLabel(task.status)}
              </Badge>
              <Badge variant="outline" className={priorityBadgeClass(task.priority)}>
                {priorityLabel(task.priority)}
              </Badge>
              <span className="text-sm text-muted-foreground">Due {formatDateTime(task.end_date)}</span>
            </div>
          </div>
        </div>
        {canEditTask ? (
          <>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
              {showMarkCompleteAction && (
                <>
                  {showStartTaskAction && (
                    <Button
                      type="button"
                      className="col-span-1 gap-2 sm:w-auto"
                      disabled={isStartingTask || isCompletingTask || isUpdatingChecklist || isUploadingImages}
                      onClick={() => void handleStartTask()}
                    >
                      {isStartingTask ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Start Task
                    </Button>
                  )}

                  <Button
                    type="button"
                    className={`${showStartTaskAction ? "col-span-1" : "col-span-2"} gap-2 sm:w-auto`}
                    disabled={task.status === "done" || isStartingTask || isCompletingTask || isUpdatingChecklist || isUploadingImages}
                    onClick={() => void handleMarkAsComplete()}
                  >
                    {isCompletingTask ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Mark as complete
                  </Button>
                </>
              )}

              <Button variant="outline" className="col-span-2 gap-2 sm:w-auto" onClick={() => setIsReassignOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" />
                Reassign
              </Button>
            </div>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">
                <span className="inline-flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  Checklist
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{completionPercent}% complete</p>
            </div>
            <Progress value={completionPercent} className="h-2" />
          </CardHeader>
          <CardContent className="space-y-2">
            {checklistItems.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                No checklist template attached.
              </div>
            ) : (
              checklistItems.map((item, index) => {
                const itemId = item.id ?? `item-${index}`
                const checked = item.id ? checklistDoneIds.has(item.id) : false
                const completedAt = item.id ? checklistCompletedAtById.get(item.id) ?? null : null
                return (
                  <label
                    key={itemId}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/20"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        if (!item.id || !canEditTask || isUpdatingChecklist) return
                        void handleToggleChecklist(item.id, nextChecked === true)
                      }}
                      disabled={!canEditTask || !item.id || isUpdatingChecklist}
                      className="mt-0.5"
                    />
                    <span
                      className={`text-sm leading-relaxed ${
                        checked ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                    {checked && completedAt ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Completed {formatDateTime(completedAt)}
                      </span>
                    ) : null}
                  </label>
                )
              })
            )}
            <div className="pt-4">
              <p className="mb-2 text-sm font-medium">Upload images</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void handleSelectImages(event)}
                className="hidden"
                disabled={!canEditTask || isUploadingImages}
              />
              <div className="w-full max-w-[420px] space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!canEditTask || isUploadingImages}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {isUploadingImages ? 'Uploading...' : 'Add images'}
                </Button>
                {uploadingImages.length > 0 ? (
                  <div className="space-y-2">
                    {uploadingImages.map((pending) => (
                      <div
                        key={pending.id}
                        className="flex items-center gap-3 rounded-md border border-dashed px-3 py-2"
                      >
                        <div className="relative h-10 w-10 overflow-hidden rounded border bg-muted">
                          <Image
                            src={pending.previewUrl}
                            alt={pending.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{pending.name}</p>
                          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Uploading...
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {checklistImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {checklistImages.map((image) => (
                      <div key={image.id} className="relative overflow-hidden rounded-md border bg-muted">
                        <div className="relative aspect-square">
                          <Image
                            src={createClient()
                              .storage.from(TASK_IMAGES_BUCKET)
                              .getPublicUrl(image.storagePath).data.publicUrl}
                            alt="Task image"
                            fill
                            className="object-cover"
                          />
                        </div>
                        {canEditTask ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(image.id)}
                            disabled={deletingImageIds.has(image.id)}
                            className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-black/80"
                            aria-label="Remove image"
                          >
                            {deletingImageIds.has(image.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    No images uploaded yet.
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload one or more reference photos for this housekeeping task.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Reservation</span>
                <span>{task.reservation?.confirmation_number?.trim() || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Assignee</span>
                <span>{assigneeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Started</span>
                <span>{formatDateTime(task.start_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Completed</span>
                <span>{task.status === "done" ? formatDateTime(task.updated_at) : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(task.created_at)}</span>
              </div>
              <div className="space-y-1 border-t pt-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="text-sm">{task.description?.trim() || "No notes available."}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0 text-sm">
              {task.start_at ? (
                <div>
                  <p className="font-medium text-foreground">Task completed</p>
                  <p className="text-muted-foreground">{formatDateTime(task.updated_at)}</p>
                </div>
              ) : null}
              
              {task.start_at ? (
                <div>
                  <p className="font-medium text-foreground">Task started</p>
                  <p className="text-muted-foreground">{formatDateTime(task.start_at)}</p>
                </div>
              ) : null}
              <div>
                <p className="font-medium text-foreground">Task created</p>
                <p className="text-muted-foreground">{formatDateTime(task.created_at)}</p>
              </div>
              {task.status === "done" ? (
                <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Marked as complete
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <ReassignTaskDialog
        open={canEditTask && isReassignOpen}
        onOpenChange={setIsReassignOpen}
        userOptions={assigneeOptions}
        currentUserId={task.staff_id}
        isSubmitting={isReassigning}
        onSubmit={handleReassignTask}
      />
    </div>
  )
}
