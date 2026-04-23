"use client"

import { useEffect, useState } from "react"
import { Droplets, Sparkles, Upload, Wrench, X, Zap } from "lucide-react"
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

export const MAINTENANCE_CATEGORY_OPTIONS = [
  { id: "electrical", label: "Electrical", Icon: Zap },
  { id: "plumbing", label: "Plumbing", Icon: Droplets },
  { id: "facility", label: "Facility", Icon: Wrench },
  { id: "cleaning_issue", label: "Cleaning Issue", Icon: Sparkles },
  { id: "other", label: "Others", Icon: Wrench },
] as const

export type MaintenanceTaskCategory = (typeof MAINTENANCE_CATEGORY_OPTIONS)[number]["id"]

export function maintenanceCategoryLabel(id: string): string {
  const normalized = id.trim().toLowerCase()
  const found = MAINTENANCE_CATEGORY_OPTIONS.find((option) => option.id === normalized)
  if (found) return found.label
  return id
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

/** Maps a stored display label (or id) back to a category id for forms. */
export function parseMaintenanceTaskCategory(
  value: string | null | undefined,
): MaintenanceTaskCategory {
  if (!value?.trim()) return "electrical"
  const trimmed = value.trim().toLowerCase()
  const byId = MAINTENANCE_CATEGORY_OPTIONS.find((option) => option.id === trimmed)
  if (byId) return byId.id
  const byLabel = MAINTENANCE_CATEGORY_OPTIONS.find(
    (option) => option.label.toLowerCase() === trimmed,
  )
  return byLabel?.id ?? "other"
}

export function MaintenanceCategoryPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const selectedValue = MAINTENANCE_CATEGORY_OPTIONS.some((option) => option.id === value)
    ? value
    : "other"

  return (
    <Select
      value={selectedValue}
      onValueChange={onChange}
      disabled={disabled ?? false}
    >
      <SelectTrigger className="h-9 w-full" aria-label="Category">
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>
        {MAINTENANCE_CATEGORY_OPTIONS.map(({ id, label }) => (
          <SelectItem key={id} value={id}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type AddMaintenanceTaskInput = {
  siteId?: string
  siteName: string
  task: string
  description?: string
  assigneeId?: string | null
  assignee: string | null
  status: "Open" | "In Progress" | "Completed"
  priority: "Low" | "Medium" | "High" | "Emergency"
  category: string
  source: "Guest" | "Housekeeping" | "Staff" | "PM" | "Checkout"
  estimatedLaborCost?: number | null
  estimatedPartsCost?: number | null
  vendorId?: string | null
  sla?: number | null
  images?: File[]
}

type LocalImageItem = {
  id: string
  file: File
  previewUrl: string
}

type AddTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  /** When false, assignee is fixed to the signed-in user (read-only, not a dropdown). */
  canAssignWorkOrder?: boolean
  /** `property_staff.id` for the current user on this property (when assign is locked). */
  selfAssigneeStaffId?: string | null
  /** Display name shown when assignee selection is locked. */
  selfAssigneeLabel?: string
  isSubmitting?: boolean
  /** Property vendors for optional task link (empty until loaded from API). */
  vendorOptions?: Array<{ id: string; label: string }>
  onSubmit: (input: AddMaintenanceTaskInput) => Promise<void>
}

const SITE_PLACEHOLDER_VALUE = "__maintenance_site_unselected__"
export const SOURCE_OPTIONS = ["Guest", "Housekeeping", "Staff", "PM", "Checkout"] as const

export function parseMaintenanceSource(
  value: string | null | undefined,
): "Guest" | "Housekeeping" | "Staff" | "PM" | "Checkout" {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "guest") return "Guest"
  if (normalized === "housekeeping") return "Housekeeping"
  if (normalized === "pm") return "PM"
  if (normalized === "checkout") return "Checkout"
  return "Staff"
}

const INITIAL_FORM: AddMaintenanceTaskInput = {
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
  vendorId: null,
  sla: null,
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  siteOptions,
  assigneeOptions,
  canAssignWorkOrder = true,
  selfAssigneeStaffId = null,
  selfAssigneeLabel = "You",
  isSubmitting = false,
  vendorOptions = [],
}: AddTaskDialogProps) {
  const [form, setForm] = useState<AddMaintenanceTaskInput>(INITIAL_FORM)
  const [customCategory, setCustomCategory] = useState("")
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
    setError(null)
    clearLocalImages()
    setCustomCategory("")
    if (!canAssignWorkOrder) {
      setForm({
        ...INITIAL_FORM,
        assigneeId: selfAssigneeStaffId,
        assignee: selfAssigneeLabel,
      })
    } else {
      setForm(INITIAL_FORM)
    }
  }, [open, canAssignWorkOrder, selfAssigneeStaffId, selfAssigneeLabel])

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
    setError(null)

    const siteId = (form.siteId ?? "").trim()
    const siteName = form.siteName.trim()
    const task = form.task.trim()
    const resolvedCategory =
      form.category === "other" ? customCategory.trim() : form.category.trim()
    const description = form.description?.trim() ?? ""
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null

    if (!siteId || !siteName || !task) {
      setError("Site and task title are required.")
      return
    }
    if (!resolvedCategory) {
      setError("Please enter a category name.")
      return
    }

    try {
      await onSubmit({
        ...form,
        siteId,
        siteName,
        task,
        category: resolvedCategory,
        description,
        assignee,
        images: localImages.map((item) => item.file),
      })
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to create task."
      setError(message)
    }
  }

  const siteSelectValue =
    form.siteId && siteOptions.some((site) => site.id === form.siteId)
      ? form.siteId
      : SITE_PLACEHOLDER_VALUE

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (
            target?.closest?.("[data-radix-select-content]") ||
            target?.closest?.("[data-radix-popper-content-wrapper]")
          ) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (
            target?.closest?.("[data-radix-select-content]") ||
            target?.closest?.("[data-radix-popper-content-wrapper]")
          ) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Add maintenance task</DialogTitle>
          <DialogDescription>
            {canAssignWorkOrder
              ? "Create a work order for a site and optionally assign it to maintenance staff."
              : "Create a work order for a site. This task will be assigned to you."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maintenance-site">Site *</Label>
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
                <SelectTrigger id="maintenance-site">
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
              <Label htmlFor="maintenance-task">Task title *</Label>
              <Input
                id="maintenance-task"
                value={form.task}
                onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
                placeholder="Enter task title"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-description">Description</Label>
            <Textarea
              id="maintenance-description"
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Add details (optional)"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maintenance-assignee">Assignee</Label>
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
                  <SelectTrigger id="maintenance-assignee">
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
                  id="maintenance-assignee"
                  readOnly
                  disabled
                  value={selfAssigneeLabel}
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
                  setForm((prev) => ({
                    ...prev,
                    source: value as AddMaintenanceTaskInput["source"],
                  }))
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
            <Label>Category</Label>
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

          <div className="space-y-2">
            <Label>Cost Estimate</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Estimated Labor Cost</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
                  <SelectValue placeholder="Select status" />
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
            <Label htmlFor="maintenance-images">Task Images</Label>
            <label
              htmlFor="maintenance-images"
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
              id="maintenance-images"
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
              {isSubmitting ? "Adding…" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
