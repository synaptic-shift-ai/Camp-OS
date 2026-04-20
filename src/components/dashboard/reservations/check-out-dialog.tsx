'use client'

/**
 * Check-out Dialog Component
 *
 * Dialog for performing guest check-out workflow.
 * Displays reservation details, handles damage reporting, and calls check-out API.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AddTaskDialog,
  type AddHousekeepingTaskInput,
} from '@/components/dashboard/housekeeping/housekeeping-dialog.tsx/add-task-dialog'
import { useToast } from '@/hooks/use-toast'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'
import { AlertCircle, Loader2, LogOut, DollarSign, Calendar, Users, Home, AlertTriangle } from 'lucide-react'
import type { Reservation } from '@/lib/booking/types'
import { asYyyyMmDd, dayOfWeekFromYyyyMmDd, formatDisplayDate, normalizeDateString } from '@/lib/utils'

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

type SiteStatusForBadge =
  | 'available'
  | 'reserved'
  | 'booked'
  | 'occupied'
  | 'housekeeping'
  | 'maintenance'
  | 'unavailable'

const SITE_STATUS_BADGE_CLASS: Record<SiteStatusForBadge, string> = {
  available: 'bg-green-500/10 text-green-600 border-green-500/20',
  reserved: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  booked: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  occupied: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  housekeeping: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  maintenance: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  unavailable: 'bg-red-500/10 text-red-600 border-red-500/20',
}

function siteStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

interface CheckOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: Reservation & {
    guest?: { first_name: string; last_name: string; email: string }
    site?: { site_number: string; site_name: string | null; status?: string | null }
  }
  allowedCheckOutDays?: string[] | undefined
  checkOutTime?: string | null | undefined
}

export function CheckOutDialog({
  open,
  onOpenChange,
  reservation,
  allowedCheckOutDays,
  checkOutTime,
}: CheckOutDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkOutNotes, setCheckOutNotes] = useState('')
  const [hasDamages, setHasDamages] = useState(false)
  const [showLateCheckOutWarning, setShowLateCheckOutWarning] = useState(false)
  const [showFollowUpTaskDialog, setShowFollowUpTaskDialog] = useState(false)
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [checklistOptions, setChecklistOptions] = useState<Array<{ id: string; label: string }>>([])
  const [assigneeOptions, setAssigneeOptions] = useState<Array<{ id: string; label: string }>>([])

  const todayStr = asYyyyMmDd(new Date())
  const reservationEndStr = normalizeDateString(reservation.check_out_date)
  const todayLabel = formatDisplayDate(todayStr)
  const todayDay = dayOfWeekFromYyyyMmDd(todayStr)
  const isBlockedByCheckOutDay =
    (allowedCheckOutDays ?? []).length > 0 &&
    !(allowedCheckOutDays ?? []).includes(todayDay) &&
    reservationEndStr >= todayStr

  // Calculate outstanding balance
  const outstandingBalance = Math.max(0, reservation.total_amount - reservation.paid_amount)
  const balanceInDollars = (outstandingBalance / 100).toFixed(2)
  const hasBalance = outstandingBalance > 0

  const rawSiteStatus = reservation.site?.status ?? null
  const siteStatusForUi =
    rawSiteStatus && rawSiteStatus in SITE_STATUS_BADGE_CLASS
      ? (rawSiteStatus as SiteStatusForBadge)
      : null

  const parsePropertyTimeForReservationDate = (time?: string | null): Date | null => {
    if (!time) return null
    const [hour = 0, minute = 0] = time.split(':').map(Number)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

    const reservationDate = new Date(`${reservationEndStr}T00:00:00`)
    if (Number.isNaN(reservationDate.getTime())) return null

    reservationDate.setHours(hour, minute, 0, 0)
    return reservationDate
  }

  const configuredCheckOutDateTime = parsePropertyTimeForReservationDate(checkOutTime)
  const isLateCheckOutAttempt =
    reservationEndStr === todayStr &&
    configuredCheckOutDateTime !== null &&
    new Date() > configuredCheckOutDateTime

  const handleCheckOut = async (forceProceed = false) => {
    setIsProcessing(true)
    setError(null)

    try {
      if (isLateCheckOutAttempt && !forceProceed) {
        setShowLateCheckOutWarning(true)
        return
      }

      if (isBlockedByCheckOutDay) {
        setError(
          `Check-out is not allowed today (${todayLabel}) due to check-out day restrictions.`
        )
        return
      }

      const response = await fetch(`/api/v1/reservations/${reservation.id}/check-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hasDamages,
          notes: checkOutNotes.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check out guest')
      }

      toast({
        title: 'Check-out Successful',
        description: `${reservation.guest?.first_name} ${reservation.guest?.last_name} has been checked out from Site ${reservation.site?.site_number}`,
        className: SEASON_ALERT_TOAST_CLASS,
      })

      onOpenChange(false)
      setShowFollowUpTaskDialog(true)
    } catch (err) {
      if (isAccessDeniedError(err)) {
        toast({
          title: 'Access denied',
          description: "You don't have permission for this action. Contact your property administrator if you believe this is an error.",
          variant: 'destructive',
          className: SEASON_ALERT_TOAST_CLASS,
        })
        return
      }
      console.error('Check-out error:', err)
      toast({
        title: 'Check-out failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setCheckOutNotes('')
    setHasDamages(false)
    setError(null)
    setShowFollowUpTaskDialog(false)
    onOpenChange(false)
  }

  const handleCreateHousekeepingTask = () => {
    setShowFollowUpTaskDialog(false)
    setIsCreateTaskDialogOpen(true)
  }

  const handleSkipFollowUpTask = () => {
    setShowFollowUpTaskDialog(false)
    onOpenChange(false)
    router.refresh()
  }

  const handleCreateTaskFromReservation = async (input: AddHousekeepingTaskInput) => {
    const siteId = input.siteId || reservation.site_id
    if (!siteId) {
      throw new Error('Site is required.')
    }

    const toApiStatus = (status: AddHousekeepingTaskInput['status']): 'pending' | 'in_progress' | 'done' => {
      if (status === 'In Progress') return 'in_progress'
      if (status === 'Done') return 'done'
      return 'pending'
    }

    const toApiPriority = (
      priority: AddHousekeepingTaskInput['priority'],
    ): 'low' | 'medium' | 'high' | 'urgent' => {
      if (priority === 'Low') return 'low'
      if (priority === 'High') return 'high'
      if (priority === 'Urgent') return 'urgent'
      return 'medium'
    }

    setIsCreatingTask(true)
    try {
      const response = await fetch(`/api/v1/properties/${reservation.property_id}/housekeeping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId,
          staffId: input.assigneeId ?? null,
          title: input.task,
          description: input.description?.trim() ? input.description.trim() : null,
          status: toApiStatus(input.status),
          reservationConfirmationId: reservation.confirmation_number,
          priority: toApiPriority(input.priority),
          startDate: input.startDate?.trim() ? input.startDate : undefined,
          dueDate: input.dueDate?.trim() ? input.dueDate : undefined,
          checklistTemplateId: input.checklistTemplateId ?? undefined,
          checklistItemDone: input.checklistItemDone ?? [],
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          'Failed to create housekeeping task.'
        throw new Error(message)
      }

      setIsCreateTaskDialogOpen(false)
      onOpenChange(false)
      toast({
        title: 'Housekeeping task created',
        description: 'A follow-up housekeeping task was created successfully.',
        className: SEASON_ALERT_TOAST_CLASS,
      })
      router.refresh()
    } finally {
      setIsCreatingTask(false)
    }
  }

  const followUpSiteLabel = reservation.site?.site_name?.trim() || reservation.site?.site_number || 'Site'
  const followUpSiteOptions = reservation.site_id
    ? [{ id: reservation.site_id, label: followUpSiteLabel }]
    : []

  const followUpInitialValues: Partial<
    Pick<AddHousekeepingTaskInput, 'siteId' | 'siteName' | 'reservationConfirmationId'>
  > = {
    ...(reservation.site_id ? { siteId: reservation.site_id } : {}),
    siteName: followUpSiteLabel,
    reservationConfirmationId: reservation.confirmation_number,
  }

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('checklist')
          .select('id, name')
          .eq('property_id', reservation.property_id)
          .order('name', { ascending: true })
        if (error) throw error
        setChecklistOptions(
          (data ?? []).map((row) => ({
            id: row.id as string,
            label: (row.name as string).trim(),
          })),
        )
      } catch {
        setChecklistOptions([])
      }
    })()
  }, [reservation.property_id])

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/properties/${reservation.property_id}/housekeeping/assignees`,
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.success) {
          throw new Error('Failed to load assignees')
        }

        setAssigneeOptions(
          Array.isArray(payload.data?.assigneeOptions) ? payload.data.assigneeOptions : [],
        )
      } catch {
        setAssigneeOptions([])
      }
    })()
  }, [reservation.property_id])

  // Format dates
  const checkInDate = new Date(reservation.check_in_date).toLocaleDateString()
  const checkOutDate = new Date(reservation.check_out_date).toLocaleDateString()
  const nights = Math.ceil(
    (new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) /
    (1000 * 60 * 60 * 24)
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-blue-600" />
              Check Out Guest
            </DialogTitle>
            <DialogDescription>
              Complete the guest departure and site inspection
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 sm:py-4">
            {/* Guest Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Guest Information
              </h3>
              <div className="grid grid-cols-1 gap-3 p-3 rounded-lg bg-muted/50 sm:grid-cols-2 sm:gap-4 sm:p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Guest Name</p>
                  <p className="font-medium break-words">
                    {reservation.guest?.first_name} {reservation.guest?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{reservation.guest?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confirmation #</p>
                  <p className="font-mono text-sm font-semibold break-all">{reservation.confirmation_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="secondary">{reservation.status}</Badge>
                </div>
              </div>
            </div>

            {/* Reservation Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Stay Summary
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Home className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Site</p>
                      <p className="font-medium mt-0.5 break-words">
                        {reservation.site?.site_name || `Site ${reservation.site?.site_number}`}
                      </p>
                    </div>
                    {rawSiteStatus ? (
                      <Badge
                        variant="outline"
                        className={`shrink-0 whitespace-nowrap ${siteStatusForUi
                          ? SITE_STATUS_BADGE_CLASS[siteStatusForUi]
                          : 'text-muted-foreground'
                          }`}
                      >
                        {siteStatusLabel(rawSiteStatus)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Stay</p>
                    <p className="font-medium text-sm break-words">
                      {checkInDate} - {checkOutDate}
                    </p>
                    <p className="text-xs text-muted-foreground">{nights} nights</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Guests</p>
                    <p className="font-medium break-words">
                      {reservation.num_adults} Adults, {reservation.num_children} Children
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-medium">${(reservation.total_amount / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Outstanding Balance Warning */}
            {hasBalance && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-semibold">Outstanding Balance: ${balanceInDollars}</span>
                  <p className="text-sm mt-1">
                    This guest has an unpaid balance. Consider collecting payment before check-out.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Site Inspection */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Site Inspection
              </h3>
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <Checkbox
                  id="damages"
                  checked={hasDamages}
                  onCheckedChange={(checked) => setHasDamages(checked === true)}
                />
                <Label htmlFor="damages" className="cursor-pointer">
                  Report damages to site or property
                </Label>
              </div>
              {hasDamages && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please describe the damages in the notes below. A maintenance ticket may be created.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <Label htmlFor="notes">Check-out Notes {hasDamages && <span className="text-destructive">*</span>}</Label>
              <Textarea
                id="notes"
                placeholder={hasDamages
                  ? "Describe the damages found during inspection..."
                  : "Record any observations, feedback, or details..."
                }
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCheckOut()}
              disabled={isProcessing || (hasDamages && !checkOutNotes.trim())}
              className="w-full sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Complete Check-out
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={showLateCheckOutWarning} onOpenChange={setShowLateCheckOutWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Late check-out warning</AlertDialogTitle>
            <AlertDialogDescription>
              This reservation is being checked out after the configured check-out time
              {checkOutTime ? ` (${checkOutTime})` : ''}. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLateCheckOutWarning(false)
                void handleCheckOut(true)
              }}
            >
              Continue check-out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={showFollowUpTaskDialog}
        onOpenChange={(next) => {
          if (!next) {
            handleSkipFollowUpTask()
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create follow-up task</DialogTitle>
            <DialogDescription>
              {reservation.guest?.first_name} {reservation.guest?.last_name} just checked out of{" "}
              {reservation.site?.site_name || `Unit ${reservation.site?.site_number}`}. Would you like to
              create a housekeeping task to prepare the unit?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="ghost" onClick={handleSkipFollowUpTask}>
              Skip
            </Button>
            <Button onClick={handleCreateHousekeepingTask}>Create Housekeeping Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddTaskDialog
        open={isCreateTaskDialogOpen}
        onOpenChange={setIsCreateTaskDialogOpen}
        siteOptions={followUpSiteOptions}
        assigneeOptions={assigneeOptions}
        checklistOptions={checklistOptions}
        initialValues={followUpInitialValues}
        isSubmitting={isCreatingTask}
        onSubmit={handleCreateTaskFromReservation}
      />
    </>
  )
}
