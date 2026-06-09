"use client"

import { useEffect, useState } from "react"
import { Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  buildDatetimeIfComplete,
  formatLocalDateKey,
  formatLocalTimeHM,
} from "@/lib/dashboard/housekeeping/datetime-local-parts"

type CampaignScheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (scheduledAt: string) => Promise<void>
  isSubmitting?: boolean
  initialScheduledAt?: string | null
}

const MIN_LEAD_MS = 60_000

function getDefaultScheduleParts(): { date: string; time: string } {
  const next = new Date(Date.now() + 3600000)
  return {
    date: formatLocalDateKey(next),
    time: formatLocalTimeHM(next),
  }
}

export function CampaignScheduleDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
  initialScheduledAt,
}: CampaignScheduleDialogProps) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initialScheduledAt) {
      const existing = new Date(initialScheduledAt)
      if (!Number.isNaN(existing.getTime())) {
        setDate(formatLocalDateKey(existing))
        setTime(formatLocalTimeHM(existing))
        setError(null)
        return
      }
    }
    const defaults = getDefaultScheduleParts()
    setDate(defaults.date)
    setTime(defaults.time)
    setError(null)
  }, [open, initialScheduledAt])

  const todayKey = formatLocalDateKey(new Date())
  const nowHm = formatLocalTimeHM(new Date())

  async function handleSubmit() {
    const merged = buildDatetimeIfComplete(date, time)
    if (!merged) {
      setError("Please select both a date and time.")
      return
    }

    const scheduledAt = new Date(merged)
    if (Number.isNaN(scheduledAt.getTime())) {
      setError("Please enter a valid date and time.")
      return
    }

    if (scheduledAt.getTime() - Date.now() < MIN_LEAD_MS) {
      setError("Schedule time must be at least 1 minute in the future.")
      return
    }

    setError(null)
    await onConfirm(scheduledAt.toISOString())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Schedule Campaign</DialogTitle>
          <DialogDescription>
            Choose when this campaign should be sent to your audience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="campaign-schedule-date">Date</Label>
            <Input
              id="campaign-schedule-date"
              type="date"
              value={date}
              min={todayKey}
              onChange={(e) => {
                setDate(e.target.value)
                setError(null)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-schedule-time">Time</Label>
            <Input
              id="campaign-schedule-time"
              type="time"
              step={60}
              value={time}
              min={date === todayKey ? nowHm : undefined}
              onChange={(e) => {
                setTime(e.target.value)
                setError(null)
              }}
            />
          </div>
          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Clock className="h-4 w-4" aria-hidden />
            )}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
