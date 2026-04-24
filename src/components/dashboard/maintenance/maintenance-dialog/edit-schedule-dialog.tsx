"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
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

// ---------------------------------------------------------------------------
// Shared input type used by both Add & Edit schedule dialogs
// ---------------------------------------------------------------------------

export type AddPreventiveScheduleInput = {
  name: string
  description: string | null
  site_id: string | null
  assigned_to: string | null
  frequency: "weekly" | "monthly" | "annual"
  days: string | null
  schedule_date: string | null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type EditScheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: {
    id: string
    name: string
    description: string | null
    site_id: string | null
    assigned_to: string | null
    frequency: string
    days: string | null
    schedule_date: string | null
  } | null
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  isSubmitting?: boolean
  onSubmit: (input: AddPreventiveScheduleInput) => Promise<void>
}

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

const EMPTY_FORM: AddPreventiveScheduleInput = {
  name: "",
  description: null,
  site_id: null,
  assigned_to: null,
  frequency: "weekly",
  days: null,
  schedule_date: null,
}

const DAY_OPTIONS = [
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
  { value: "Saturday", label: "Saturday" },
  { value: "Sunday", label: "Sunday" },
]

const SITE_PLACEHOLDER_VALUE = "__schedule_edit_site_unselected__"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditScheduleDialog({
  open,
  onOpenChange,
  schedule,
  siteOptions,
  assigneeOptions,
  isSubmitting = false,
  onSubmit,
}: EditScheduleDialogProps) {
  const [form, setForm] = useState<AddPreventiveScheduleInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill form when dialog opens with schedule data
  useEffect(() => {
    if (!open) return

    if (!schedule) {
      setForm(EMPTY_FORM)
      setError(null)
      return
    }

    setForm({
      name: schedule.name ?? "",
      description: schedule.description ?? null,
      site_id: schedule.site_id ?? null,
      assigned_to: schedule.assigned_to ?? null,
      frequency: (schedule.frequency as AddPreventiveScheduleInput["frequency"]) ?? "weekly",
      days: schedule.days ?? null,
      schedule_date: schedule.schedule_date ?? null,
    })
    setError(null)
  }, [open, schedule])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = form.name.trim()
    if (!name) {
      setError("Schedule name is required.")
      return
    }

    try {
      await onSubmit(form)
      onOpenChange(false)
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to update schedule."
      setError(message)
    }
  }

  const siteSelectValue =
    form.site_id && siteOptions.some((site) => site.id === form.site_id)
      ? form.site_id
      : SITE_PLACEHOLDER_VALUE

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit schedule</DialogTitle>
          <DialogDescription>
            Update the preventive maintenance schedule and save your changes.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="edit-schedule-name">Name *</Label>
            <Input
              id="edit-schedule-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Schedule name"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-schedule-site">Site scope</Label>
              <Select
                value={siteSelectValue}
                onValueChange={(value) => {
                  if (value === SITE_PLACEHOLDER_VALUE) {
                    setForm((prev) => ({ ...prev, site_id: null }))
                    return
                  }
                  setForm((prev) => ({ ...prev, site_id: value }))
                }}
              >
                <SelectTrigger id="edit-schedule-site">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SITE_PLACEHOLDER_VALUE} className="text-muted-foreground">
                    All sites
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
              <Label htmlFor="edit-schedule-assignee">Assignee</Label>
              <Select
                value={form.assigned_to ?? "unassigned"}
                onValueChange={(value) => {
                  if (value === "unassigned") {
                    setForm((prev) => ({ ...prev, assigned_to: null }))
                    return
                  }
                  setForm((prev) => ({ ...prev, assigned_to: value }))
                }}
              >
                <SelectTrigger id="edit-schedule-assignee">
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
            <Label htmlFor="edit-schedule-description">Description</Label>
            <Textarea
              id="edit-schedule-description"
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value.trim() ? event.target.value : null,
                }))
              }
              placeholder="Add details (optional)"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    frequency: value as AddPreventiveScheduleInput["frequency"],
                  }))
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.frequency === "weekly" ? (
              <div className="space-y-2">
                <Label>Day of week</Label>
                <Select
                  value={form.days ?? ""}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, days: value }))
                  }
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Anchor date</Label>
                <Input
                  type="date"
                  value={form.schedule_date ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      schedule_date: event.target.value || null,
                    }))
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
