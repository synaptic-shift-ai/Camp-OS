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
  onSubmit: (input: AddHousekeepingTaskInput & { id: string }) => void
}

const EMPTY_FORM: AddHousekeepingTaskInput = {
  siteName: "",
  task: "",
  assignee: null,
  status: "Pending",
  priority: "Medium",
  dueTime: "",
  zone: "",
}

export function EditTaskDialog({ open, onOpenChange, task, onSubmit }: EditTaskDialogProps) {
  const [form, setForm] = useState<AddHousekeepingTaskInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (!task) {
      setForm(EMPTY_FORM)
      return
    }

    setForm({
      siteName: task.siteName,
      task: task.task,
      assignee: task.assignee,
      status: task.status,
      priority: task.priority,
      dueTime: task.dueTime,
      zone: task.zone ?? "",
    })
    setError(null)
  }, [open, task])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return

    const siteName = form.siteName.trim()
    const taskName = form.task.trim()
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null

    if (!siteName || !taskName) {
      setError("Site and task are required.")
      return
    }

    onSubmit({
      id: task.id,
      siteName,
      task: taskName,
      assignee,
      status: form.status,
      priority: task.priority,
      dueTime: task.dueTime,
      zone: task.zone ?? "Unassigned",
    })
    onOpenChange(false)
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
              <Input
                id="edit-housekeeping-site"
                value={form.siteName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, siteName: event.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-housekeeping-assignee">Assignee</Label>
              <Input
                id="edit-housekeeping-assignee"
                value={form.assignee ?? ""}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assignee: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-housekeeping-task">Task *</Label>
            <Textarea
              id="edit-housekeeping-task"
              value={form.task}
              onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
              rows={3}
              required
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
