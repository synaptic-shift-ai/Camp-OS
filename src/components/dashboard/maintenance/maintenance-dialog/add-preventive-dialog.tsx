"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"

export const PREVENTIVE_FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
] as const

export const WEEKLY_DAY_OPTIONS = [
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
  { value: "Saturday", label: "Saturday" },
  { value: "Sunday", label: "Sunday" },
] as const

const WEEKLY_DAY_VALUES = new Set<string>(WEEKLY_DAY_OPTIONS.map((o) => o.value))

export type PreventiveScheduleFrequency = (typeof PREVENTIVE_FREQUENCY_OPTIONS)[number]["value"]

export type AddPreventiveScheduleInput = {
  /** When null, the schedule applies to all sites on the property. */
  siteId: string | null
  assigneeId: string | null
  name: string
  description: string | null
  frequency: PreventiveScheduleFrequency
  /** Optional day or interval hint (e.g. weekdays, JSON); stored as free text. */
  days: string | null
  /** ISO `yyyy-mm-dd` for `schedule_date`, or null when unset. */
  scheduleDate: string | null
}

type AddPreventiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  isSubmitting?: boolean
  onSubmit: (input: AddPreventiveScheduleInput) => Promise<void>
}

const ALL_SITES_VALUE = "__preventive_all_sites__"
const UNASSIGNED_VALUE = "__preventive_unassigned__"

const INITIAL_FORM: AddPreventiveScheduleInput = {
  siteId: null,
  assigneeId: null,
  name: "",
  description: null,
  frequency: "monthly",
  days: null,
  scheduleDate: null,
}

export function AddPreventiveDialog({
  open,
  onOpenChange,
  siteOptions,
  assigneeOptions,
  isSubmitting = false,
  onSubmit,
}: AddPreventiveDialogProps) {
  const [form, setForm] = useState<AddPreventiveScheduleInput>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(INITIAL_FORM)
    setError(null)
  }, [open])

  const siteSelectValue =
    form.siteId && siteOptions.some((s) => s.id === form.siteId) ? form.siteId : ALL_SITES_VALUE

  const assigneeSelectValue =
    form.assigneeId && assigneeOptions.some((a) => a.id === form.assigneeId)
      ? form.assigneeId
      : UNASSIGNED_VALUE

  const anchorDate = useMemo(() => {
    const raw = form.scheduleDate?.trim()
    if (!raw) return undefined
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
    if (!m) return undefined
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }, [form.scheduleDate])

  const monthlyDayOfMonth = useMemo(() => {
    if (form.frequency !== "monthly") return null
    const raw = form.scheduleDate?.trim()
    if (!raw) return null
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
    if (!m) return null
    const day = Number(m[3])
    if (!Number.isFinite(day) || day < 1 || day > 31) return null
    return String(day)
  }, [form.frequency, form.scheduleDate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const name = form.name.trim()
    const description = form.description?.trim() ? form.description.trim() : null

    let days: string | null = form.days?.trim() ? form.days.trim() : null
    let scheduleDate: string | null = form.scheduleDate?.trim() ? form.scheduleDate.trim() : null

    if (form.frequency === "weekly") {
      scheduleDate = null
      if (!days || !WEEKLY_DAY_VALUES.has(days)) {
        days = "Monday"
      }
    }

    if (form.frequency === "monthly") {
      // Treat scheduleDate as "day of month" by storing the next upcoming date on that day.
      // Example: selecting 13 means "every 13th", stored as the next YYYY-MM-13.
      const day = scheduleDate ? Number(scheduleDate.slice(-2)) : NaN
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
      scheduleDate = format(next, "yyyy-MM-dd")
    }

    if (!name) {
      setError("Schedule name is required.")
      return
    }

    try {
      await onSubmit({
        ...form,
        name,
        description,
        days,
        scheduleDate,
      })
      onOpenChange(false)
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to create preventive schedule."
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (
            target?.closest?.("[data-radix-select-content]") ||
            target?.closest?.("[data-radix-popper-content-wrapper]") ||
            target?.closest?.('[data-slot="popover-content"]')
          ) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (
            target?.closest?.("[data-radix-select-content]") ||
            target?.closest?.("[data-radix-popper-content-wrapper]") ||
            target?.closest?.('[data-slot="popover-content"]')
          ) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Add preventive schedule</DialogTitle>
          <DialogDescription>
            Define recurring maintenance for a site or the whole property. For weekly schedules, pick
            a day of the week; otherwise set an optional anchor date.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="preventive-name">Schedule name *</Label>
            <Input
              id="preventive-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Weekly electrical inspection"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Site scope</Label>
              <Select
                value={siteSelectValue}
                onValueChange={(value) => {
                  if (value === ALL_SITES_VALUE) {
                    setForm((prev) => ({ ...prev, siteId: null }))
                    return
                  }
                  setForm((prev) => ({ ...prev, siteId: value }))
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue
                    placeholder={
                      siteOptions.length === 0 ? "No sites on this property" : "Select site scope"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SITES_VALUE}>All sites</SelectItem>
                  {siteOptions.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select
                value={assigneeSelectValue}
                onValueChange={(value) => {
                  if (value === UNASSIGNED_VALUE) {
                    setForm((prev) => ({ ...prev, assigneeId: null }))
                    return
                  }
                  setForm((prev) => ({ ...prev, assigneeId: value }))
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
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
            <Label htmlFor="preventive-description">Description</Label>
            <Textarea
              id="preventive-description"
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value || null,
                }))
              }
              placeholder="Checklist, scope, or notes (optional)"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(value) => {
                  const next = value as PreventiveScheduleFrequency
                  setForm((prev) => {
                    if (next === "weekly") {
                      const keepDay =
                        prev.days && WEEKLY_DAY_VALUES.has(prev.days) ? prev.days : "Monday"
                      return { ...prev, frequency: next, scheduleDate: null, days: keepDay }
                    }
                    if (prev.frequency === "weekly") {
                      return { ...prev, frequency: next, days: null }
                    }
                    return { ...prev, frequency: next }
                  })
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {PREVENTIVE_FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {form.frequency === "weekly" ? (
                <>
                  <Label>Day of week</Label>
                  <Select
                    value={
                      form.days && WEEKLY_DAY_VALUES.has(form.days) ? form.days : "Monday"
                    }
                    onValueChange={(day) => setForm((prev) => ({ ...prev, days: day }))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-9 w-full" aria-label="Day of week">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKLY_DAY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Repeats every week on this day.</p>
                </>
              ) : (
                <>
                  <Label>Anchor date</Label>
                  {form.frequency === "monthly" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={31}
                          step={1}
                          value={monthlyDayOfMonth ?? ""}
                          onChange={(event) => {
                            const raw = event.target.value
                            if (!raw.trim()) {
                              setForm((prev) => ({ ...prev, scheduleDate: null }))
                              return
                            }
                            const parsed = Number.parseInt(raw, 10)
                            const safeDay = Number.isFinite(parsed)
                              ? Math.min(31, Math.max(1, parsed))
                              : 1
                            setForm((prev) => ({
                              ...prev,
                              scheduleDate: `2000-01-${String(safeDay).padStart(2, "0")}`,
                            }))
                          }}
                          placeholder="Day"
                          disabled={isSubmitting}
                        />
                        <span className="text-xs text-muted-foreground">of the month</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Repeats every month on this day.</p>
                    </>
                  ) : (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isSubmitting}
                            className="h-9 w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.scheduleDate
                              ? format(new Date(form.scheduleDate), "MMM dd, yyyy")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={anchorDate}
                            onSelect={(date) =>
                              setForm((prev) => ({
                                ...prev,
                                scheduleDate: date ? format(date, "yyyy-MM-dd") : null,
                              }))
                            }
                            disabled={isSubmitting}
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">Optional start or next-due calendar date.</p>
                    </>
                  )}
                </>
              )}
            </div>
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
              {isSubmitting ? "Saving…" : "Add schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
