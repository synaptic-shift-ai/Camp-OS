"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  HousekeepingQueries,
  parseChecklistTemplateLines,
} from "@/lib/dashboard/housekeeping/housekeeping-queries"
import type { SupabaseClient } from "@supabase/supabase-js"
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
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"
import {
  formatLocalDateKey,
  formatLocalTimeHM,
  mergeDatetimeLocalValue,
  splitDatetimeLocalValue,
} from "@/lib/dashboard/housekeeping/datetime-local-parts"

export type AddHousekeepingTaskInput = {
  siteId?: string
  siteName: string
  task: string
  description?: string
  assigneeId?: string | null
  assignee: string | null
  reservationConfirmationId?: string
  checklistTemplateId?: string | null
  checklistItemDone?: Array<{ item_id: string; status: "pending" | "completed" }>
  status: "Pending" | "In Progress" | "Done"
  priority: "Low" | "Medium" | "High" | "Urgent"
  startDate?: string
  dueDate?: string
  dueTime: string
  zone: string
}

type AddTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  checklistOptions: Array<{ id: string; label: string }>
  onCustomizeChecklist?: () => void
  initialValues?: Partial<
    Pick<
      AddHousekeepingTaskInput,
      "siteId" | "siteName" | "reservationConfirmationId" | "startDate" | "dueDate"
    >
  >
  isSubmitting?: boolean
  onSubmit: (input: AddHousekeepingTaskInput) => Promise<void>
}

const INITIAL_FORM: AddHousekeepingTaskInput = {
  siteId: "",
  siteName: "",
  task: "",
  description: "",
  assigneeId: null,
  assignee: null,
  reservationConfirmationId: "",
  checklistTemplateId: null,
  checklistItemDone: [],
  status: "Pending",
  priority: "Medium",
  startDate: "",
  dueDate: "",
  dueTime: "",
  zone: "",
}

const MOBILE_PICKER_SPACE_PX = 320

export function AddTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  siteOptions,
  assigneeOptions,
  checklistOptions,
  onCustomizeChecklist,
  initialValues,
  isSubmitting = false,
}: AddTaskDialogProps) {
  const [form, setForm] = useState<AddHousekeepingTaskInput>(INITIAL_FORM)
  const cleanFormRef = useRef("")
  const [checklistItems, setChecklistItems] = useState<
    Array<{ id: string; label: string; notes: string | null }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [startDateInput, setStartDateInput] = useState("")
  const [startTimeInput, setStartTimeInput] = useState("")
  const [dueDateInput, setDueDateInput] = useState("")
  const [dueTimeInput, setDueTimeInput] = useState("")

  const todayKey = formatLocalDateKey(new Date())
  const nowHm = formatLocalTimeHM(new Date())
  const ensureNativeTimePickerSpace = (input: HTMLInputElement) => {
    const dialogContent = input.closest("[role='dialog']")
    if (!(dialogContent instanceof HTMLElement)) return

    // Native mobile time pickers can render tall overlays; pre-scroll to avoid bottom clipping.
    const inputRect = input.getBoundingClientRect()
    const spaceBelow = window.innerHeight - inputRect.bottom
    if (spaceBelow >= MOBILE_PICKER_SPACE_PX) return

    const offset = MOBILE_PICKER_SPACE_PX - spaceBelow + 12
    dialogContent.scrollBy({ top: offset, behavior: "smooth" })
  }

  useEffect(() => {
    if (!open) return
    const initialStartParts = splitDatetimeLocalValue(initialValues?.startDate ?? "")
    const initialDueParts = splitDatetimeLocalValue(initialValues?.dueDate ?? "")
    setForm({
      ...INITIAL_FORM,
      ...initialValues,
    })
    setStartDateInput(initialStartParts.date)
    setStartTimeInput(initialStartParts.time)
    setDueDateInput(initialDueParts.date)
    setDueTimeInput(initialDueParts.time)
    setChecklistItems([])
    setError(null)
    cleanFormRef.current = JSON.stringify({ ...INITIAL_FORM, ...initialValues })
  }, [open, initialValues])

  const isDirty = JSON.stringify(form) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const siteId = (form.siteId ?? "").trim()
    const siteName = form.siteName.trim()
    const task = form.task.trim()
    const description = form.description?.trim() ?? ""
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null
    const reservationConfirmationId = form.reservationConfirmationId?.trim() ?? ""
    const startDate = form.startDate?.trim() ?? ""
    const dueDate = form.dueDate?.trim() ?? ""
    const checklistItemDone =
      checklistItems.length > 0
        ? checklistItems.map((item) => ({
            item_id: item.id,
            status: "pending" as const,
          }))
        : form.checklistItemDone ?? []

    if (!siteId || !siteName || !task) {
      setError("Site and task are required.")
      return
    }
    if (!startDate || !dueDate) {
      setError("Start date and due date are required.")
      return
    }
    const now = new Date()
    if (startDate && new Date(startDate) < now) {
      setError("Start date must be today or in the future.")
      return
    }
    if (dueDate && new Date(dueDate) < now) {
      setError("Due date must be today or in the future.")
      return
    }

    try {
      await onSubmit({
        ...form,
        siteId,
        siteName,
        task,
        description,
        dueTime: "TBD",
        zone: "Unassigned",
        assignee,
        reservationConfirmationId,
        checklistItemDone,
      })
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to create task."
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-lg overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Add Housekeeping Task</DialogTitle>
          <DialogDescription>
            Create a new housekeeping task and assign details for your team.
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
              <Label htmlFor="housekeeping-site">Site *</Label>
              <Select
                value={form.siteId ?? ""}
                onValueChange={(value) => {
                  const selectedSite = siteOptions.find((site) => site.id === value)
                  setForm((prev) => ({
                    ...prev,
                    siteId: value,
                    siteName: selectedSite?.label ?? "",
                  }))
                }}
              >
                <SelectTrigger id="housekeeping-site">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {siteOptions.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="housekeeping-assignee">Assignee</Label>
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
                <SelectTrigger id="housekeeping-assignee">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="housekeeping-task">Task Title *</Label>
            <Input
              id="housekeeping-task"
              value={form.task}
              onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="housekeeping-description">Description</Label>
            <Textarea
              id="housekeeping-description"
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
              <Label htmlFor="housekeeping-reservation-confirmation-id">
                Reservation confirmation ID (optional)
              </Label>
              <Input
                id="housekeeping-reservation-confirmation-id"
                value={form.reservationConfirmationId ?? ""}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    reservationConfirmationId: event.target.value,
                  }))
                }
                placeholder="e.g. RES-123456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="housekeeping-checklist-template">Checklist Template</Label>
              <Select
                value={form.checklistTemplateId ?? "none"}
                onValueChange={(value) => {
                  if (value === "customize") {
                    onCustomizeChecklist?.()
                    return
                  }

                  if (value === "none") {
                    setForm((prev) => ({
                      ...prev,
                      checklistTemplateId: null,
                      checklistItemDone: [],
                    }))
                    setChecklistItems([])
                    return
                  }

                  setForm((prev) => ({
                    ...prev,
                    checklistTemplateId: value,
                  }))

                  const loadChecklistItemDone = async () => {
                    const supabase = createClient()
                    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)

                    try {
                      const item = await queries.getChecklistTemplateItem(value)
                      const parsed = parseChecklistTemplateLines(item ?? [])
                      const mappedItems = parsed
                        .map((line, index) => ({
                          id: line.id ?? `${value}-${index + 1}`,
                          label: line.label,
                          notes: line.notes,
                        }))
                        .filter((line) => line.id.trim().length > 0)

                      setChecklistItems(mappedItems)
                      setForm((prev) => ({
                        ...prev,
                        checklistItemDone: mappedItems.map((line) => ({
                          item_id: line.id,
                          status: "pending" as const,
                        })),
                      }))
                    } catch (loadError) {
                      const message =
                        loadError instanceof Error ? loadError.message : "Failed to load checklist items."
                      setError(message)
                      setChecklistItems([])
                    }
                  }

                  void loadChecklistItemDone()
                }}
              >
                <SelectTrigger id="housekeeping-checklist-template">
                  <SelectValue placeholder="Select checklist template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {checklistOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="customize">Customize (Create new checklist)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.checklistTemplateId ? (
            <div className="space-y-2 rounded-md border border-border/80 p-3">
              <Label>Checklist Items</Label>
              {checklistItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No checklist items found for this template.</p>
              ) : (
                <div className="space-y-2">
                  {checklistItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-border/60 px-3 py-2"
                    >
                      <span className="text-sm">
                        <span className="font-medium">{item.label}</span>
                        {item.notes ? (
                          <span className="block text-xs text-muted-foreground">{item.notes}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(priority: AddHousekeepingTaskInput["priority"]) =>
                  setForm((prev) => ({ ...prev, priority }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(status: AddHousekeepingTaskInput["status"]) =>
                  setForm((prev) => ({ ...prev, status }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="housekeeping-start-date">Start date *</Label>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  id="housekeeping-start-date"
                  type="date"
                  className="min-w-0"
                  value={startDateInput}
                  min={todayKey}
                  onChange={(event) => {
                    const date = event.target.value
                    setStartDateInput(date)
                    setForm((prev) => ({
                      ...prev,
                      startDate: mergeDatetimeLocalValue(date, startTimeInput),
                    }))
                  }}
                  required
                />
                <Input
                  id="housekeeping-start-time"
                  type="time"
                  step={60}
                  className="min-w-0"
                  value={startTimeInput}
                  min={startDateInput === todayKey ? nowHm : undefined}
                  onFocus={(event) => ensureNativeTimePickerSpace(event.currentTarget)}
                  onChange={(event) => {
                    const time = event.target.value
                    setStartTimeInput(time)
                    setForm((prev) => ({
                      ...prev,
                      startDate: mergeDatetimeLocalValue(startDateInput, time),
                    }))
                  }}
                  required
                />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="housekeeping-due-date">Due date *</Label>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  id="housekeeping-due-date"
                  type="date"
                  className="min-w-0"
                  value={dueDateInput}
                  min={todayKey}
                  onChange={(event) => {
                    const date = event.target.value
                    setDueDateInput(date)
                    setForm((prev) => ({
                      ...prev,
                      dueDate: mergeDatetimeLocalValue(date, dueTimeInput),
                    }))
                  }}
                  required
                />
                <Input
                  id="housekeeping-due-time"
                  type="time"
                  step={60}
                  className="min-w-0"
                  value={dueTimeInput}
                  min={dueDateInput === todayKey ? nowHm : undefined}
                  onFocus={(event) => ensureNativeTimePickerSpace(event.currentTarget)}
                  onChange={(event) => {
                    const time = event.target.value
                    setDueTimeInput(time)
                    setForm((prev) => ({
                      ...prev,
                      dueDate: mergeDatetimeLocalValue(dueDateInput, time),
                    }))
                  }}
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {unsavedChangesDialog}
  )
}
