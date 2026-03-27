'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CalendarDays, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

type ScheduleStatus = 'housekeeping' | 'maintenance'

interface HousekeepingScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: {
    id: string
    site_number: string
    site_name?: string | null
    availability_rules?: {
      blocked_dates?: Array<{ from: string; to: string; reason: string }>
    } | null
  }
  status: ScheduleStatus
}

const statusLabels: Record<ScheduleStatus, string> = {
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function HousekeepingScheduleDialog({
  open,
  onOpenChange,
  site,
  status,
}: HousekeepingScheduleDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSingleDay, setIsSingleDay] = useState(true)
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = statusLabels[status]
  const siteName = site.site_name || `Site ${site.site_number}`

  const hasValidSelection = isSingleDay ? !!dateFrom : !!(dateFrom && dateTo)

  const handleSingleDayToggle = (checked: boolean) => {
    setIsSingleDay(checked)
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  useEffect(() => {
    if (!open) return
  
    const existing = site.availability_rules?.blocked_dates?.[0]
    if (!existing) return
  
    const from = new Date(existing.from + 'T00:00:00') // avoid timezone shift
    const to = new Date(existing.to + 'T00:00:00')
    const isSame = existing.from === existing.to
  
    setIsSingleDay(isSame)
    if (isSame) {
      setDateFrom(from)
    } else {
      setDateFrom(from)
      setDateTo(to)
    }
  }, [open])

  const handleConfirm = async () => {
    const fromDate = isSingleDay ? dateFrom : dateFrom
    const toDate = isSingleDay ? dateFrom : dateTo

    if (!fromDate || !toDate) {
      setError('Please select date(s)')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const from = format(fromDate, 'yyyy-MM-dd')
    const to = format(toDate, 'yyyy-MM-dd')

    try {
      const response = await fetch(`/api/v1/sites/${site.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability_rules: {
            blocked_dates: [{ from, to, reason: status }],
          },
        }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || `Failed to schedule ${label.toLowerCase()}`)
      }

      toast({
        title: `${label} Scheduled`,
        description: `${siteName} scheduled for ${label.toLowerCase()} on ${from}${from !== to ? ` – ${to}` : ''}`,
        className: SEASON_ALERT_TOAST_CLASS,
      })

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast({
        title: `${label} scheduling failed`,
        description: err instanceof Error ? err.message : `Failed to schedule ${label.toLowerCase()}`,
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsSingleDay(true)
      setDateFrom(undefined)
      setDateTo(undefined)
      setError(null)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-purple-500" />
            Schedule {label}
          </DialogTitle>
          <DialogDescription>
            Select a date for {label.toLowerCase()} on{' '}
            <strong>{siteName}</strong>. The site status will be set to{' '}
            <strong>{label.toLowerCase()}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Single day toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="single-day"
              checked={isSingleDay}
              onCheckedChange={(checked) => handleSingleDayToggle(checked === true)}
            />
            <Label htmlFor="single-day" className="cursor-pointer text-sm font-medium">
              Single day
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label htmlFor="houseKeepingFrom" className="text-xs text-muted-foreground mb-1 block">
                {isSingleDay ? "Date" : "Start Date"}
              </Label>
              <Input
                id="houseKeepingFrom"
                type="date"
                value={dateFrom ? format(dateFrom, 'yyyy-MM-dd') : ''}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setDateFrom(new Date(e.target.value))}
              />
            </div>

            {!isSingleDay && (
              <div className="flex-1">
                <Label htmlFor="houseKeepingTo" className="text-xs text-muted-foreground mb-1 block">
                  End Date
                </Label>
                <Input
                  id="houseKeepingTo"
                  type="date"
                  value={dateTo ? format(dateTo, 'yyyy-MM-dd') : ''}
                  min={dateFrom ? format(dateFrom, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setDateTo(new Date(e.target.value))}
                />
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={(!isSingleDay && !hasValidSelection) || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              `Confirm ${label}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
