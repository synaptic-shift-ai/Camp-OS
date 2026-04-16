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

export type AddMaintenanceTaskInput = {
  siteId?: string
  siteName: string
  task: string
  description?: string
  assigneeId?: string | null
  assignee: string | null
  status: "Open" | "In Progress" | "Completed"
}

type AddTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  isSubmitting?: boolean
  onSubmit: (input: AddMaintenanceTaskInput) => Promise<void>
}

const SITE_PLACEHOLDER_VALUE = "__maintenance_site_unselected__"

const INITIAL_FORM: AddMaintenanceTaskInput = {
  siteName: "",
  task: "",
  description: "",
  assigneeId: null,
  assignee: null,
  status: "Open",
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  siteOptions,
  assigneeOptions,
  isSubmitting = false,
}: AddTaskDialogProps) {
  const [form, setForm] = useState<AddMaintenanceTaskInput>(INITIAL_FORM)
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
      setError("Site and task title are required.")
      return
    }

    try {
      await onSubmit({
        ...form,
        siteId,
        siteName,
        task,
        description,
        assignee,
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
            Create a work order for a site and optionally assign it to maintenance staff.
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
              <Label htmlFor="maintenance-assignee">Assignee</Label>
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
            </div>
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

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(status: AddMaintenanceTaskInput["status"]) =>
                setForm((prev) => ({ ...prev, status }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
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
