"use client"

import { useEffect, useState } from "react"
import { Upload, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  MaintenanceCategoryPicker,
  SOURCE_OPTIONS,
  parseMaintenanceSource,
  parseMaintenanceTaskCategory,
  type AddMaintenanceTaskInput,
} from "./add-task-dialog"
import type { MaintenanceTaskRow } from "../maintenance-table"

type EditTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: MaintenanceTaskRow | null
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  isSubmitting?: boolean
  onSubmit: (input: AddMaintenanceTaskInput & { id: string }) => Promise<void>
}

const SITE_PLACEHOLDER_VALUE = "__maintenance_edit_site_unselected__"

type LocalImageItem = {
  id: string
  file: File
  previewUrl: string
}

const EMPTY_FORM: AddMaintenanceTaskInput = {
  siteName: "",
  task: "",
  description: "",
  assigneeId: null,
  assignee: null,
  status: "Open",
  priority: "Low",
  category: "electrical",
  source: "Staff",
  estimatedLaborCost: null,
  estimatedPartsCost: null,
  vendorName: "",
  vendorEmail: "",
}

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  siteOptions,
  assigneeOptions,
  isSubmitting = false,
  onSubmit,
}: EditTaskDialogProps) {
  const [form, setForm] = useState<AddMaintenanceTaskInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [localImages, setLocalImages] = useState<LocalImageItem[]>([])

  const clearLocalImages = () => {
    setLocalImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      return []
    })
  }

  useEffect(() => {
    if (!open) return
    if (!task) {
      setForm(EMPTY_FORM)
      return
    }

    setForm({
      siteId: task.siteId ?? "",
      siteName: task.siteName,
      task: task.task,
      description: task.description ?? "",
      assigneeId: task.assigneeId ?? null,
      assignee: task.assignee,
      status: task.status,
      priority: task.priority,
      category: parseMaintenanceTaskCategory(task.category),
      source: parseMaintenanceSource(task.source),
      estimatedLaborCost: task.estimatedLaborCost ?? null,
      estimatedPartsCost: task.estimatedPartsCost ?? null,
      vendorName: task.vendorName ?? "",
      vendorEmail: task.vendorEmail ?? "",
    })
    setError(null)
    clearLocalImages()
  }, [open, task])

  const handleImageSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const nextItems = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }))

    if (nextItems.length === 0) return
    setLocalImages((prev) => [...prev, ...nextItems])
  }

  const handleRemoveLocalImage = (id: string) => {
    setLocalImages((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return

    const siteId = (form.siteId ?? "").trim()
    const siteName = form.siteName.trim()
    const taskName = form.task.trim()
    const description = form.description?.trim() ?? ""
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null

    if (!siteId || !siteName || !taskName) {
      setError("Site and task title are required.")
      return
    }

    try {
      await onSubmit({
        id: task.id,
        siteId,
        siteName,
        task: taskName,
        description,
        assigneeId: form.assigneeId ?? null,
        assignee,
        status: form.status,
        priority: form.priority,
        category: form.category,
        source: form.source,
        estimatedLaborCost: form.estimatedLaborCost ?? null,
        estimatedPartsCost: form.estimatedPartsCost ?? null,
        vendorName: form.vendorName?.trim() ?? "",
        vendorEmail: form.vendorEmail?.trim() ?? "",
      })
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to update task."
      setError(message)
    }
  }

  const siteSelectValue =
    form.siteId && siteOptions.some((site) => site.id === form.siteId)
      ? form.siteId
      : SITE_PLACEHOLDER_VALUE

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit maintenance task</DialogTitle>
          <DialogDescription>Update the task details and save your changes.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-maintenance-site">Site *</Label>
              <Select
                value={siteSelectValue}
                onValueChange={(value) => {
                  if (value === SITE_PLACEHOLDER_VALUE) {
                    setForm((prev) => {
                      const { siteId: _omit, ...rest } = prev
                      return { ...rest, siteName: "" }
                    })
                    return
                  }
                  const selectedSite = siteOptions.find((site) => site.id === value)
                  setForm((prev) => ({
                    ...prev,
                    siteId: value,
                    siteName: selectedSite?.label ?? "",
                  }))
                }}
              >
                <SelectTrigger id="edit-maintenance-site">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SITE_PLACEHOLDER_VALUE} className="text-muted-foreground">
                    {siteOptions.length === 0
                      ? "No maintenance sites available"
                      : "Select a site"}
                  </SelectItem>
                  {siteOptions.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-maintenance-task">Task title *</Label>
              <Input
                id="edit-maintenance-task"
                value={form.task}
                onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
                placeholder="Enter task title"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-maintenance-description">Description</Label>
            <Textarea
              id="edit-maintenance-description"
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Add task details (optional)"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-maintenance-assignee">Assignee</Label>
              <Select
                value={form.assigneeId ?? "unassigned"}
                onValueChange={(value) => {
                  if (value === "unassigned") {
                    setForm((prev) => ({ ...prev, assigneeId: null, assignee: null }))
                    return
                  }
                  const selectedAssignee = assigneeOptions.find((option) => option.id === value)
                  setForm((prev) => ({
                    ...prev,
                    assigneeId: value,
                    assignee: selectedAssignee?.label ?? null,
                  }))
                }}
              >
                <SelectTrigger id="edit-maintenance-assignee">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assigneeOptions.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      {assignee.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={form.source}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, source: value as AddMaintenanceTaskInput["source"] }))
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Category</Label>
            <MaintenanceCategoryPicker
              value={form.category}
              onChange={(category) => setForm((prev) => ({ ...prev, category }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label>Cost Estimate</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Estimated Labor Cost</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    placeholder="Enter labor cost estimate"
                    className="pl-7"
                    value={form.estimatedLaborCost ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value
                      setForm((prev) => ({
                        ...prev,
                        estimatedLaborCost: raw === "" ? null : Number(raw),
                      }))
                    }}
                    min={0}
                    step={1}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Estimated Parts Cost</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    placeholder="Enter cost estimate"
                    className="pl-7"
                    value={form.estimatedPartsCost ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value
                      setForm((prev) => ({
                        ...prev,
                        estimatedPartsCost: raw === "" ? null : Number(raw),
                      }))
                    }}
                    min={0}
                    step={1}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vendor Details</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Vendor Name</Label>
                <Input
                  type="text"
                  placeholder="Enter vendor name"
                  value={form.vendorName ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, vendorName: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Vendor Email</Label>
                <Input
                  type="email"
                  placeholder="Enter vendor email"
                  value={form.vendorEmail ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, vendorEmail: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(status: AddMaintenanceTaskInput["status"]) =>
                  setForm((prev) => ({ ...prev, status }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(priority: AddMaintenanceTaskInput["priority"]) =>
                  setForm((prev) => ({ ...prev, priority }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-maintenance-images">Task Images</Label>
            <label
              htmlFor="edit-maintenance-images"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
                "border-[#d9d2c3] bg-transparent text-[#4f6149] hover:bg-muted/10",
                isSubmitting && "pointer-events-none opacity-60",
              )}
            >
              <Upload className="size-5" aria-hidden />
              <span className="text-2xl leading-none">+</span>
              <p className="text-base font-medium">Click to upload images</p>
            </label>
            <Input
              id="edit-maintenance-images"
              type="file"
              accept="image/*"
              multiple
              disabled={isSubmitting}
              className="sr-only"
              onChange={(event) => {
                handleImageSelection(event.target.files)
                event.currentTarget.value = ""
              }}
            />
            {localImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {localImages.map((item) => (
                  <div key={item.id} className="relative overflow-hidden rounded-md border border-border">
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-24 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLocalImage(item.id)}
                      className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-black/75"
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                    <p className="truncate px-2 py-1 text-[11px] text-muted-foreground">
                      {item.file.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
