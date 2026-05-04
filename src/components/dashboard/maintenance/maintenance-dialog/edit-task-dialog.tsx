"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, Upload, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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
import { PermissionGate } from "@/components/ui/permission-gate"
import { useToast } from "@/hooks/use-toast"
import {
  MaintenanceCategoryPicker,
  SOURCE_OPTIONS,
  parseMaintenanceSource,
  parseMaintenanceTaskCategory,
  type AddMaintenanceTaskInput,
} from "./add-task-dialog"
import type { MaintenanceTaskRow } from "../wo-list/maintenance-table"

type EditTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: MaintenanceTaskRow | null
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  /** When false, assignee cannot be changed (read-only, not a dropdown). */
  canAssignWorkOrder?: boolean
  isSubmitting?: boolean
  vendorOptions?: Array<{ id: string; label: string }>
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
  isSuspectedDamage: false,
  vendorId: null,
  sla: null,
  scheduledStart: null,
  dueDate: null,
}

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  siteOptions,
  assigneeOptions,
  canAssignWorkOrder = true,
  isSubmitting = false,
  vendorOptions = [],
  onSubmit,
}: EditTaskDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<AddMaintenanceTaskInput>(EMPTY_FORM)
  const [customCategory, setCustomCategory] = useState("")
  const [localImages, setLocalImages] = useState<LocalImageItem[]>([])

  // Auto-compute due date from SLA + scheduled start
  useEffect(() => {
    if (form.sla && form.sla > 0 && form.scheduledStart && !form.dueDate) {
      const target = new Date(new Date(form.scheduledStart).getTime() + form.sla * 3600 * 1000)
      setForm((prev) => ({ ...prev, dueDate: target.toISOString() }))
    }
  }, [form.sla, form.scheduledStart, form.dueDate])

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
      setCustomCategory("")
      return
    }

    const parsedCategory = parseMaintenanceTaskCategory(task.category)
    setForm({
      siteId: task.siteId ?? "",
      siteName: task.siteName,
      task: task.task,
      description: task.description ?? "",
      assigneeId: task.assigneeId ?? null,
      assignee: task.assignee,
      status: task.status,
      priority: task.priority,
      category: parsedCategory,
      source: parseMaintenanceSource(task.source),
      estimatedLaborCost: task.estimatedLaborCost ?? null,
      estimatedPartsCost: task.estimatedPartsCost ?? null,
      isSuspectedDamage: task.isSuspectedDamage ?? false,
      vendorId: task.vendorId ?? null,
      sla: task.sla ?? null,
      scheduledStart: task.scheduledStart ?? null,
      dueDate: task.dueDate ?? null,
    })
    setCustomCategory(parsedCategory === "other" ? task.category ?? "" : "")
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
    const resolvedCategory =
      form.category === "other" ? customCategory.trim() : form.category.trim()
    const description = form.description?.trim() ?? ""
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null

    if (!siteId || !siteName || !taskName) {
      toast({
        title: "Missing required fields",
        description: "Site and task title are required.",
        variant: "destructive",
      })
      return
    }
    if (!resolvedCategory) {
      toast({
        title: "Missing category",
        description: "Please enter a category name.",
        variant: "destructive",
      })
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
        category: resolvedCategory,
        source: form.source,
        estimatedLaborCost: form.estimatedLaborCost ?? null,
        estimatedPartsCost: form.estimatedPartsCost ?? null,
        vendorId: form.vendorId ?? null,
        sla: form.sla ?? null,
        scheduledStart: form.scheduledStart ?? null,
        dueDate: form.dueDate ?? null,
        images: localImages.map((item) => item.file),
      })
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to update task."
      toast({
        title: "Unable to update task",
        description: message,
        variant: "destructive",
      })
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
              {canAssignWorkOrder ? (
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
              ) : (
                <Input
                  id="edit-maintenance-assignee"
                  readOnly
                  disabled
                  value={form.assignee?.trim() ? form.assignee : "Unassigned"}
                  className="bg-muted"
                  aria-readonly="true"
                />
              )}
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
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="edit-maintenance-suspected-damage"
                checked={form.isSuspectedDamage}
                disabled={task?.status === "Completed" || task?.status === "Cancelled"}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isSuspectedDamage: event.target.checked }))
                }
                className="h-4 w-4 rounded border-border disabled:opacity-50"
              />
              <Label htmlFor="edit-maintenance-suspected-damage" className="cursor-pointer">Suspected Guest Damage</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Category</Label>
            <MaintenanceCategoryPicker
              value={form.category}
              onChange={(category) => {
                setForm((prev) => ({ ...prev, category }))
                if (category !== "other") setCustomCategory("")
              }}
              disabled={isSubmitting}
            />
            {form.category === "other" ? (
              <Input
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                placeholder="Enter new category"
                disabled={isSubmitting}
                required
              />
            ) : null}
          </div>

          <PermissionGate permission="maintenance.enter_labor_cost" fallback={null}>
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
                    disabled={task?.status === "Completed"}
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
                    disabled={task?.status === "Completed"}
                  />
                </div>
              </div>
            </div>
          </div>
          </PermissionGate>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Linked vendor</Label>
              <Select
                value={form.vendorId ?? "none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    vendorId: value === "none" ? null : value,
                  }))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue
                    placeholder={
                      vendorOptions.length === 0 ? "No vendors on file (add in Vendors)" : "Select vendor"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vendorOptions.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">SLA (hours)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="Optional"
                disabled={isSubmitting}
                value={form.sla ?? ""}
                onChange={(event) => {
                  const raw = event.target.value
                  setForm((prev) => ({
                    ...prev,
                    sla: raw === "" ? null : Number(raw),
                  }))
                }}
              />
              {!form.sla && task?.status === "Open" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  SLA is required before starting work on this order.
                </p>
              )}
            </div>
          </div>

          {/* Scheduled Start & Due Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Scheduled Start</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn("w-full justify-start text-left font-normal", !form.scheduledStart && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.scheduledStart ? format(new Date(form.scheduledStart), "MMM dd, yyyy HH:mm") : "Pick a date & time"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.scheduledStart ? new Date(form.scheduledStart) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const time = form.scheduledStart ? format(new Date(form.scheduledStart), "HH:mm") : "08:00"
                        const [h, m] = time.split(":").map(Number)
                        setForm((prev) => ({
                          ...prev,
                          scheduledStart: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m).toISOString(),
                        }))
                      }
                    }}
                  />
                  <div className="border-t p-3">
                    <Input
                      type="time"
                      value={form.scheduledStart ? format(new Date(form.scheduledStart), "HH:mm") : "08:00"}
                      onChange={(e) => {
                        const date = form.scheduledStart ? new Date(form.scheduledStart) : new Date()
                        const [h, m] = e.target.value.split(":").map(Number)
                        setForm((prev) => ({
                          ...prev,
                          scheduledStart: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m).toISOString(),
                        }))
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Due Date</Label>
                {form.sla && form.scheduledStart ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      const target = new Date(new Date(form.scheduledStart!).getTime() + form.sla! * 3600 * 1000)
                      setForm((prev) => ({ ...prev, dueDate: target.toISOString() }))
                    }}
                  >
                    Auto-calculate from SLA
                  </button>
                ) : null}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn("w-full justify-start text-left font-normal", !form.dueDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.dueDate ? format(new Date(form.dueDate), "MMM dd, yyyy HH:mm") : "Pick a date & time"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.dueDate ? new Date(form.dueDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const time = form.dueDate ? format(new Date(form.dueDate), "HH:mm") : "17:00"
                        const [h, m] = time.split(":").map(Number)
                        setForm((prev) => ({
                          ...prev,
                          dueDate: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m).toISOString(),
                        }))
                      }
                    }}
                  />
                  <div className="border-t p-3">
                    <Input
                      type="time"
                      value={form.dueDate ? format(new Date(form.dueDate), "HH:mm") : "17:00"}
                      onChange={(e) => {
                        const date = form.dueDate ? new Date(form.dueDate) : new Date()
                        const [h, m] = e.target.value.split(":").map(Number)
                        setForm((prev) => ({
                          ...prev,
                          dueDate: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m).toISOString(),
                        }))
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* SLA validation warning */}
          {form.dueDate && form.sla && form.scheduledStart ? (() => {
            const expectedDue = new Date(form.scheduledStart!).getTime() + form.sla! * 3600 * 1000
            const dueMs = new Date(form.dueDate).getTime()
            if (dueMs < expectedDue) {
              return (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                  Due date is before SLA target — task may breach SLA
                </div>
              )
            }
            return null
          })() : null}

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
                  <SelectItem value="In Progress (Vendor)">In Progress (Vendor)</SelectItem>
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
