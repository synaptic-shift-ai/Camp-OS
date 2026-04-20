"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
  HousekeepingQueries,
  parseChecklistTemplateLines,
} from "@/lib/dashboard/housekeeping/housekeeping-queries"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { AddHousekeepingTaskInput } from "./add-task-dialog"
import type { HousekeepingTaskRow } from "../housekeeping-table"

type EditTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: HousekeepingTaskRow | null
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  checklistOptions: Array<{ id: string; label: string }>
  isSubmitting?: boolean
  onSubmit: (input: AddHousekeepingTaskInput & { id: string }) => Promise<void>
}

const EMPTY_FORM: AddHousekeepingTaskInput = {
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

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  siteOptions,
  assigneeOptions,
  checklistOptions,
  isSubmitting = false,
  onSubmit,
}: EditTaskDialogProps) {
  const [form, setForm] = useState<AddHousekeepingTaskInput>(EMPTY_FORM)
  const [checklistItems, setChecklistItems] = useState<
    Array<{ id: string; label: string; notes: string | null; checked: boolean }>
  >([])
  const [error, setError] = useState<string | null>(null)

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
      reservationConfirmationId: task.reservationConfirmationId ?? "",
      checklistTemplateId: task.checklistId ?? null,
      checklistItemDone: task.checklistItemDone ?? [],
      status: task.status,
      priority: task.priority,
      startDate: task.startDateValue ?? "",
      dueDate: task.dueDateValue ?? "",
      dueTime: task.dueTime,
      zone: task.zone ?? "",
    })
    setError(null)
  }, [open, task])

  useEffect(() => {
    const checklistId = form.checklistTemplateId
    if (!open || !checklistId) {
      setChecklistItems([])
      return
    }

    let isCancelled = false
    const selectedDone = new Set(
      (form.checklistItemDone ?? [])
        .filter((item) => item.status === "completed")
        .map((item) => item.item_id),
    )

    const loadChecklistItems = async () => {
      const supabase = createClient()
      const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)

      try {
        const item = await queries.getChecklistTemplateItem(checklistId)
        if (isCancelled) return

        const parsed = parseChecklistTemplateLines(item ?? [])
        setChecklistItems(
          parsed.map((line, index) => {
            const fallbackId = `${checklistId}-${index + 1}`
            const id = line.id ?? fallbackId
            return {
              id,
              label: line.label,
              notes: line.notes,
              checked: selectedDone.has(id),
            }
          }),
        )
      } catch (loadError) {
        if (isCancelled) return
        const message =
          loadError instanceof Error ? loadError.message : "Failed to load checklist items."
        setError(message)
        setChecklistItems([])
      }
    }

    void loadChecklistItems()
    return () => {
      isCancelled = true
    }
  }, [open, form.checklistTemplateId, form.checklistItemDone])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return

    const siteId = (form.siteId ?? "").trim()
    const siteName = form.siteName.trim()
    const taskName = form.task.trim()
    const description = form.description?.trim() ?? ""
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null
    const reservationConfirmationId = form.reservationConfirmationId?.trim() ?? ""
    const checklistItemDone = checklistItems.map((item) => ({
      item_id: item.id,
      status: item.checked ? ("completed" as const) : ("pending" as const),
    }))

    if (!siteId || !siteName || !taskName) {
      setError("Site and task are required.")
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
        reservationConfirmationId,
        checklistTemplateId: form.checklistTemplateId ?? null,
        checklistItemDone,
        priority: form.priority,
        ...(form.startDate ? { startDate: form.startDate } : {}),
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        dueTime: form.dueDate || task.dueTime,
        zone: task.zone ?? "Unassigned",
      })
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to update task."
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Housekeeping Task</DialogTitle>
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
              <Label htmlFor="edit-housekeeping-site">Site *</Label>
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
                <SelectTrigger id="edit-housekeeping-site">
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
              <Label htmlFor="edit-housekeeping-assignee">Assignee</Label>
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
                <SelectTrigger id="edit-housekeeping-assignee">
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
            <Label htmlFor="edit-housekeeping-task">Task Title *</Label>
            <Input
              id="edit-housekeeping-task"
              value={form.task}
              onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-housekeeping-description">Description</Label>
            <Textarea
              id="edit-housekeeping-description"
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
              <Label htmlFor="edit-housekeeping-reservation-confirmation-id">
                Reservation confirmation ID (optional)
              </Label>
              <Input
                id="edit-housekeeping-reservation-confirmation-id"
                value={form.reservationConfirmationId ?? ""}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, reservationConfirmationId: event.target.value }))
                }
                placeholder="e.g. RES-123456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-housekeeping-checklist-template">Checklist Template</Label>
              <Select
                value={form.checklistTemplateId ?? "none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    checklistTemplateId: value === "none" ? null : value,
                    checklistItemDone: value === "none" ? [] : prev.checklistItemDone ?? [],
                  }))
                }
              >
                <SelectTrigger id="edit-housekeeping-checklist-template">
                  <SelectValue placeholder="Select checklist template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {checklistOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                    <label
                      key={item.id}
                      className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2"
                    >
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(checked) =>
                          setChecklistItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, checked: Boolean(checked) } : row,
                            ),
                          )
                        }
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{item.label}</span>
                        {item.notes ? (
                          <span className="block text-xs text-muted-foreground">{item.notes}</span>
                        ) : null}
                      </span>
                    </label>
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
                  <SelectValue />
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
                  <SelectValue />
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
            <div className="space-y-2">
              <Label htmlFor="edit-housekeeping-start-date">Start Date</Label>
              <Input
                id="edit-housekeeping-start-date"
                type="datetime-local"
                value={form.startDate ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-housekeeping-due-date">Due Date</Label>
              <Input
                id="edit-housekeeping-due-date"
                type="datetime-local"
                value={form.dueDate ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
