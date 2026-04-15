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
  siteName: string
  task: string
  assignee: string | null
  status: "Pending" | "In Progress" | "Done"
  priority: "Low" | "Medium" | "High"
  dueTime: string
  zone: string
}

type AddTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: AddHousekeepingTaskInput) => void
}

const INITIAL_FORM: AddHousekeepingTaskInput = {
  siteName: "",
  task: "",
  assignee: null,
  status: "Pending",
  priority: "Medium",
  dueTime: "",
  zone: "",
}

export function AddTaskDialog({ open, onOpenChange, onSubmit }: AddTaskDialogProps) {
  const [form, setForm] = useState<AddHousekeepingTaskInput>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(INITIAL_FORM)
    setError(null)
  }, [open])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const siteName = form.siteName.trim()
    const task = form.task.trim()
    const assignee = form.assignee?.trim() ? form.assignee.trim() : null

    if (!siteName || !task) {
      setError("Site and task are required.")
      return
    }

    onSubmit({
      ...form,
      siteName,
      task,
      priority: "Medium",
      dueTime: "TBD",
      zone: "Unassigned",
      assignee,
    })
    onOpenChange(false)
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
              <Input
                id="housekeeping-site"
                value={form.siteName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, siteName: event.target.value }))
                }
                placeholder="Site A12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="housekeeping-assignee">Assignee</Label>
              <Input
                id="housekeeping-assignee"
                value={form.assignee ?? ""}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assignee: event.target.value }))
                }
                placeholder="Team member name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="housekeeping-task">Task *</Label>
            <Textarea
              id="housekeeping-task"
              value={form.task}
              onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
              placeholder="Describe the housekeeping task"
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
