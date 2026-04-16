"use client"

import { useEffect, useState } from "react"
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
import type { AddHousekeepingTaskInput } from "./add-task-dialog"
import type { HousekeepingTaskRow } from "../housekeeping-table"

type EditTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: HousekeepingTaskRow | null
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
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
  status: "Pending",
  priority: "Medium",
  dueTime: "",
  zone: "",
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
  const [form, setForm] = useState<AddHousekeepingTaskInput>(EMPTY_FORM)
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
      status: task.status,
      priority: task.priority,
      dueTime: task.dueTime,
      zone: task.zone ?? "",
    })
    setError(null)
  }, [open, task])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return

    const siteId = (form.siteId ?? "").trim()
    const siteName = form.siteName.trim()
    const taskName = form.task.trim()
    const description = form.description?.trim() ?? ""
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null

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
        priority: task.priority,
        dueTime: task.dueTime,
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
