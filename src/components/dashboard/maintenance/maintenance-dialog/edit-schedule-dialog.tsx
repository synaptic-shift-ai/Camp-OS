"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarIcon, Loader2, X } from "lucide-react"
import { format, startOfDay } from "date-fns"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"
import { Calendar } from "@/components/ui/calendar"

// ---------------------------------------------------------------------------
// Shared input type used by both Add & Edit schedule dialogs
// ---------------------------------------------------------------------------

export type AddPreventiveScheduleInput = {
  name: string
  description: string | null
  site_id: string
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
  site_id: "",
  assigned_to: null,
  frequency: "weekly",
  days: null,
  schedule_date: null,
}

function toDayOfMonth(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!m) return null
  const day = Number(m[3])
  if (!Number.isFinite(day) || day < 1 || day > 31) return null
  return String(day)
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
  const cleanFormRef = useRef<string>("")

  const anchorDate = useMemo(() => {
    const raw = form.schedule_date?.trim()
    if (!raw) return undefined
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
    if (!m) return undefined
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }, [form.schedule_date])

  // Pre-fill form when dialog opens with schedule data
  useEffect(() => {
    if (!open) return

    if (!schedule) {
      setForm(EMPTY_FORM)
      cleanFormRef.current = JSON.stringify(EMPTY_FORM)
      setError(null)
      return
    }

    const newForm = {
      name: schedule.name ?? "",
      description: schedule.description ?? null,
      site_id: schedule.site_id ?? "",
      assigned_to: schedule.assigned_to ?? null,
      frequency: (schedule.frequency as AddPreventiveScheduleInput["frequency"]) ?? "weekly",
      days: schedule.days ?? null,
      schedule_date: schedule.schedule_date ?? null,
    }
    setForm(newForm)
    cleanFormRef.current = JSON.stringify(newForm)
    setError(null)
  }, [open, schedule])

  const isDirty = JSON.stringify(form) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = form.name.trim()
    if (!name) {
      setError("Schedule name is required.")
      return
    }
    const siteId = form.site_id.trim()
    if (!siteId) {
      setError("Site is required.")
      return
    }

    try {
      const nextForm = { ...form, name, site_id: siteId }
      if (nextForm.frequency === "monthly") {
        const dayStr = toDayOfMonth(nextForm.schedule_date)
        const day = dayStr ? Number.parseInt(dayStr, 10) : NaN
        const selectedDay = Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth()
        const todayStart = new Date(year, month, now.getDate())
        const thisMonthCandidate = new Date(year, month, selectedDay)
        const next =
          thisMonthCandidate >= todayStart
            ? thisMonthCandidate
            : new Date(year, month + 1, selectedDay)
        nextForm.schedule_date = format(next, "yyyy-MM-dd")
      }
      await onSubmit(nextForm)
      onOpenChange(false)
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to update schedule."
      setError(message)
    }
  }

  const siteSelectValue =
    form.site_id && siteOptions.some((site) => site.id === form.site_id) ? form.site_id : ""

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
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
                  setForm((prev) => ({ ...prev, site_id: value }))
                }}
              >
                <SelectTrigger id="edit-schedule-site">
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
                {form.frequency === "monthly" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      step={1}
                      value={toDayOfMonth(form.schedule_date) ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value
                        if (!raw.trim()) {
                          setForm((prev) => ({ ...prev, schedule_date: null }))
                          return
                        }
                        const parsed = Number.parseInt(raw, 10)
                        const safeDay = Number.isFinite(parsed)
                          ? Math.min(31, Math.max(1, parsed))
                          : 1
                        setForm((prev) => ({
                          ...prev,
                          schedule_date: `2000-01-${String(safeDay).padStart(2, "0")}`,
                        }))
                      }}
                      placeholder="Day"
                    />
                    <span className="text-xs text-muted-foreground">of the month</span>
                  </div>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="relative h-9 w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.schedule_date && anchorDate
                          ? format(anchorDate, "MMM dd, yyyy")
                          : "Pick a date"}
                        {form.schedule_date && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setForm((prev) => ({ ...prev, schedule_date: null }))
                            }}
                            className="ml-auto mr-1 inline-flex h-4 w-4 items-center justify-center rounded-sm opacity-70 hover:opacity-100"
                            aria-label="Clear date"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={anchorDate}
                        onSelect={(date: Date | undefined) =>
                          setForm((prev) => ({
                            ...prev,
                            schedule_date: date ? format(date, "yyyy-MM-dd") : null,
                          }))
                        }
                        disabled={(date: Date) => date < startOfDay(new Date())}
                        defaultMonth={anchorDate ?? new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => guardedOnOpenChange(false)}
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
    {unsavedChangesDialog}
  )
}
