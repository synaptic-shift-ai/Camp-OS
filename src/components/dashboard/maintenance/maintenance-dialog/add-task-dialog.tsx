"use client"

import { useEffect, useState } from "react"
import { format, startOfDay } from "date-fns"
import { AlertTriangle, CalendarIcon, Droplets, Sparkles, Upload, Wrench, X, Zap } from "lucide-react"
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
  status: "Open" | "In Progress" | "In Progress (Vendor)" | "On Hold" | "Completed" | "Cancelled"
  priority: "Low" | "Medium" | "High" | "Emergency"
  category: string
  source: "Guest" | "Housekeeping" | "Staff" | "PM" | "Checkout"
  estimatedLaborCost?: number | null
  estimatedPartsCost?: number | null
  isSuspectedDamage?: boolean
  vendorId?: string | null
  guideId?: string | null
  scheduledStart?: string | null
  dueDate?: string | null
  sla?: number | null
  images?: File[]
}

type LocalImageItem = {
  id: string
  file: File
  previewUrl: string
}

type AddTaskDialogProps = {
  propertyId: string
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
  /** Maintenance guides for optional task link. */
  guideOptions?: Array<{ id: string; label: string }>
  onSubmit: (input: AddMaintenanceTaskInput) => Promise<void>
}

const SITE_PLACEHOLDER_VALUE = "__maintenance_site_unselected__"
export const SOURCE_OPTIONS = ["Guest", "Housekeeping", "Staff", "PM", "Checkout"] as const

function BookingConflictWarning({ propertyId, siteId, startDate, endDate }: { propertyId: string; siteId: string; startDate: string; endDate: string }) {
  const [maintenanceConflicts, setMaintenanceConflicts] = useState<number | null>(null)
  const [reservationConflicts, setReservationConflicts] = useState<number | null>(null)
  const [
    firstReservationConflict,
    setFirstReservationConflict,
  ] = useState<{
    confirmationNumber: string | null
    checkInDate: string
    checkOutDate: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    const startDateOnly = new Date(startDate).toISOString().slice(0, 10)
    const endDateOnly = new Date(endDate).toISOString().slice(0, 10)
    const params = new URLSearchParams({ siteId, startDate: startDateOnly, endDate: endDateOnly })
    fetch(`/api/v1/properties/${propertyId}/maintenance/booking-conflicts?${params}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        return { ok: res.ok, json }
      })
      .then(({ ok, json }) => {
        if (cancelled) return
        if (ok && json?.success) {
          setMaintenanceConflicts(json.data?.maintenanceConflicts ?? 0)
          setReservationConflicts(json.data?.reservationConflicts ?? 0)
          setFirstReservationConflict(json.data?.firstReservationConflict ?? null)
        } else {
          setMaintenanceConflicts(null)
          setReservationConflicts(null)
          setFirstReservationConflict(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaintenanceConflicts(null)
          setReservationConflicts(null)
          setFirstReservationConflict(null)
        }
      })
    return () => { cancelled = true }
  }, [propertyId, siteId, startDate, endDate])

  if ((maintenanceConflicts === null && reservationConflicts === null) || (maintenanceConflicts === 0 && reservationConflicts === 0)) {
    return null
  }

  const blockedCheckIn = firstReservationConflict?.checkInDate
    ? format(new Date(firstReservationConflict.checkInDate), "MMM d")
    : null
  const blockedCheckOut = firstReservationConflict?.checkOutDate
    ? format(new Date(firstReservationConflict.checkOutDate), "MMM d")
    : null

  return (
    <div className="space-y-2">
      {maintenanceConflicts !== null && maintenanceConflicts > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
          ⚠ This site has {maintenanceConflicts} active maintenance task{maintenanceConflicts === 1 ? "" : "s"} overlapping with the selected dates.
        </div>
      )}
      {reservationConflicts !== null && reservationConflicts > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-600 dark:bg-red-950/30 dark:text-red-400">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" aria-hidden />
            <div className="min-w-0">
              <div className="font-medium">
                Blocked: Guest booking{" "}
                {firstReservationConflict?.confirmationNumber?.trim()
                  ? `#${firstReservationConflict.confirmationNumber.trim()}`
                  : ""}
              </div>
              {blockedCheckIn && blockedCheckOut ? (
                <div className="text-xs text-red-600 dark:text-red-300">
                  {blockedCheckIn} &ndash; {blockedCheckOut}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
  isSuspectedDamage: false,
  vendorId: null,
  guideId: null,
  scheduledStart: null,
  dueDate: null,
  sla: null,
}

export function AddTaskDialog({
  propertyId,
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
  guideOptions = [],
}: AddTaskDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<AddMaintenanceTaskInput>(INITIAL_FORM)
  const [customCategory, setCustomCategory] = useState("")
  const [localImages, setLocalImages] = useState<LocalImageItem[]>([])

  const clearLocalImages = () => {
    setLocalImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      return []
    })
  }

  useEffect(() => {
    if (!open) return
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

    const siteId = (form.siteId ?? "").trim()
    const siteName = form.siteName.trim()
    const task = form.task.trim()
    const resolvedCategory =
      form.category === "other" ? customCategory.trim() : form.category.trim()
    const description = form.description?.trim() ?? ""
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null

    if (!siteId || !siteName || !task) {
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

    if (form.isSuspectedDamage && localImages.length === 0) {
      toast({
        title: "Photos required",
        description: "Photos are required when suspected guest damage is flagged.",
        variant: "destructive",
      })
      return
    }

    if (form.scheduledStart && form.dueDate) {
      const scheduledStartMs = new Date(form.scheduledStart).getTime()
      const dueDateMs = new Date(form.dueDate).getTime()
      if (Number.isFinite(scheduledStartMs) && Number.isFinite(dueDateMs) && dueDateMs < scheduledStartMs) {
        toast({
          title: "Invalid schedule window",
          description: "Due date must be the same or after the scheduled start.",
          variant: "destructive",
        })
        return
      }
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
      toast({
        title: "Unable to create task",
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
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="maintenance-suspected-damage"
                checked={form.isSuspectedDamage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isSuspectedDamage: event.target.checked }))
                }
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="maintenance-suspected-damage" className="cursor-pointer">Suspected Guest Damage</Label>
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

          <PermissionGate permission="maintenance.enter_labor_cost" fallback={null}>
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
          </PermissionGate>

          <div className="space-y-2">
            <Label>Linked vendor</Label>
            <Select
              value={form.vendorId ?? "none"}
              onValueChange={(value) =>
                setForm((prev) => {
                  const vendorId = value === "none" ? null : value
                  let nextStatus = prev.status
                  if (vendorId && prev.status === "In Progress") {
                    nextStatus = "In Progress (Vendor)"
                  }
                  if (!vendorId && prev.status === "In Progress (Vendor)") {
                    nextStatus = "In Progress"
                  }
                  return { ...prev, vendorId, status: nextStatus }
                })
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
            <Label>Linked Guide</Label>
            <Select
              value={form.guideId ?? "none"}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  guideId: value === "none" ? null : value,
                }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={guideOptions.length === 0 ? "No guides available" : "Select a guide"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {guideOptions.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    defaultMonth={form.scheduledStart ? new Date(form.scheduledStart) : new Date()}
                    disabled={(date: Date) => date < startOfDay(new Date())}
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
              <Label>Due Date</Label>
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
                    defaultMonth={form.dueDate ? new Date(form.dueDate) : new Date()}
                    disabled={(date: Date) => date < startOfDay(new Date())}
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

          <div className="space-y-2">
            <Label htmlFor="maintenance-sla">SLA (hours)</Label>
            <Input
              id="maintenance-sla"
              type="number"
              placeholder="e.g., 24"
              min={1}
              max={87600}
              step={1}
              value={form.sla ?? ""}
              onChange={(event) => {
                const raw = event.target.value
                setForm((prev) => ({
                  ...prev,
                  sla: raw === "" ? null : Number(raw),
                }))
              }}
            />
            <p className="text-xs text-muted-foreground">Enter the Service Level Agreement target in hours</p>
          </div>

          {/* Booking conflict warning */}
          {form.siteId && form.scheduledStart && form.dueDate && <BookingConflictWarning propertyId={propertyId} siteId={form.siteId} startDate={form.scheduledStart} endDate={form.dueDate} />}

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
                  {form.vendorId ? (
                    <SelectItem value="In Progress (Vendor)">In Progress (Vendor)</SelectItem>
                  ) : (
                    <SelectItem value="In Progress">In Progress</SelectItem>
                  )}
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
            <div className="flex items-center gap-2">
              <Label htmlFor="maintenance-images">Task Images</Label>
              {form.isSuspectedDamage && (
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Photos required</span>
              )}
            </div>
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
