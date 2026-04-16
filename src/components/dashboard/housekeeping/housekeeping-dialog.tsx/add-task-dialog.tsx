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

export type AddHousekeepingTaskInput = {
  siteId?: string
  siteName: string
  task: string
  description?: string
  assigneeId?: string | null
  assignee: string | null
  status: "Pending" | "In Progress" | "Done"
  priority: "Low" | "Medium" | "High"
  dueTime: string
  zone: string
}

type AddTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
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
  status: "Pending",
  priority: "Medium",
  dueTime: "",
  zone: "",
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  siteOptions,
  assigneeOptions,
  isSubmitting = false,
}: AddTaskDialogProps) {
  const [form, setForm] = useState<AddHousekeepingTaskInput>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(INITIAL_FORM)
    setError(null)
  }, [open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const siteId = (form.siteId ?? "").trim()
    const siteName = form.siteName.trim()
    const task = form.task.trim()
    const description = form.description?.trim() ?? ""
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null

    if (!siteId || !siteName || !task) {
      setError("Site and task are required.")
      return
    }

    try {
      await onSubmit({
        ...form,
        siteId,
        siteName,
        task,
        description,
        priority: "Medium",
        dueTime: "TBD",
        zone: "Unassigned",
        assignee,
      })
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to create task."
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
  )
}
