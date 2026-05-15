'use client'

/**
 * Cancellation Rule Dialog
 *
 * Dialog to add or edit a single cancellation rule: Refund % and Days Before Reservation.
 * Used by Cancellation Policy settings to build cancellation_policy_config rules.
 *
 * @module components/dashboard/settings/cancellation-rule-dialog
 */

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useDialogCloseGuard } from '@/hooks/use-dialog-close-guard'
import { v4 as uuidv4 } from 'uuid'

function numOrUndefined(val: unknown): number | undefined {
  if (val === '' || val === undefined) return undefined
  if (typeof val === 'number' && Number.isNaN(val)) return undefined
  return val as number
}

const cancellationRuleSchema = z.object({
  refundPercentage: z.preprocess(
    numOrUndefined,
    z.number().int().min(0, 'Must be 0 or more').max(100, 'Must be 100 or less').optional()
  ),
  daysBeforeReservation: z.preprocess(
    numOrUndefined,
    z.number().int().min(0, 'Must be 0 or more').optional()
  ),
}).refine(
  (data) => data.refundPercentage !== undefined && data.daysBeforeReservation !== undefined,
  { message: 'Refund % and Days before reservation are required', path: ['refundPercentage'] }
)

export type CancellationRuleFormData = z.infer<typeof cancellationRuleSchema>

/** Shape of one rule for cancellation_policy_config (e.g. refund_tiers) */
export type CancellationRule = {
  id: string
  refund_percentage: number
  days_before_reservation: number
}

export type CancellationRuleDialogSubmitPayload = CancellationRule

interface CancellationRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (rule: CancellationRuleDialogSubmitPayload) => void
  initialValues?: Partial<CancellationRule> | null
  existingRules?: CancellationRule[]
  title?: string
  submitLabel?: string
}

const defaultValues: CancellationRuleFormData = {
  refundPercentage: undefined,
  daysBeforeReservation: undefined,
}

export function CancellationRuleDialog({
  open,
  onOpenChange,
  onSubmit: onFormSubmit,
  initialValues,
  existingRules = [],
  title = 'Add cancellation rule',
  submitLabel = 'Add rule',
}: CancellationRuleDialogProps) {
  const form = useForm<CancellationRuleFormData>({
    resolver: zodResolver(cancellationRuleSchema),
    defaultValues: {
      refundPercentage: initialValues?.refund_percentage ?? defaultValues.refundPercentage,
      daysBeforeReservation: initialValues?.days_before_reservation ?? defaultValues.daysBeforeReservation,
    },
  })

  const isSubmitting = form.formState.isSubmitting
  const cleanFormRef = useRef<string>("")

  useEffect(() => {
    if (open) {
      form.reset({
        refundPercentage: initialValues?.refund_percentage ?? defaultValues.refundPercentage,
        daysBeforeReservation: initialValues?.days_before_reservation ?? defaultValues.daysBeforeReservation,
      })
      cleanFormRef.current = JSON.stringify({
        refundPercentage: initialValues?.refund_percentage ?? defaultValues.refundPercentage,
        daysBeforeReservation: initialValues?.days_before_reservation ?? defaultValues.daysBeforeReservation,
      })
    }
  }, [open, initialValues?.refund_percentage, initialValues?.days_before_reservation, form])

  const isDirty = form.formState.isDirty && cleanFormRef.current !== ""

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({ isDirty, open, onOpenChange })

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset(defaultValues)
    onOpenChange(next)
  }

  const onSubmit = (data: CancellationRuleFormData) => {
    const refund = data.refundPercentage
    const days = data.daysBeforeReservation
    if (refund === undefined || days === undefined) return

    const otherRules = existingRules.filter((r) => r.id !== initialValues?.id)
    const isDuplicateDays = otherRules.some((r) => r.days_before_reservation === days)
    if (isDuplicateDays) {
      form.setError('root', {
        type: 'manual',
        message: 'Another rule already uses this number of days. Use a different value for days before reservation to avoid conflicts.',
      })
      return
    }

    form.clearErrors('root')
    onFormSubmit({
      id: initialValues?.id ?? uuidv4(),
      refund_percentage: refund,
      days_before_reservation: days,
    })
    form.reset(defaultValues)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Set the refund percentage and the number of days before check-in for this rule.
          </DialogDescription>
        </DialogHeader>
        {form.formState.errors.root?.message && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root?.message}
          </p>
        )}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refundPercentage">Refund %</Label>
            <Input
              id="refundPercentage"
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 50"
              {...form.register('refundPercentage', { valueAsNumber: true })}
              className={form.formState.errors.root?.message ? 'border-destructive' : ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daysBeforeReservation">Days before reservation</Label>
            <Input
              id="daysBeforeReservation"
              type="number"
              min={0}
              placeholder="e.g. 7"
              className={form.formState.errors.daysBeforeReservation ? 'border-destructive' : ''}
              {...form.register('daysBeforeReservation', { valueAsNumber: true })}
            />
            {form.formState.errors.daysBeforeReservation && (
              <p className="text-sm text-destructive">
                {form.formState.errors.daysBeforeReservation.message}
              </p>
            )}
            {(() => {
              const refundPct = form.watch('refundPercentage') ?? 0
              const days = form.watch('daysBeforeReservation') ?? 0
              if (refundPct > 0) {
                return (
                  <p className="text-xs text-muted-foreground">
                    Eligible for {refundPct}% refund if the cancellation is made at least {days} days before check-in.
                  </p>
                )
              }
              return (
                <p className="text-xs text-muted-foreground">
                  Not eligible for any refund if the cancellation is made within {days} days of check-in.
                </p>
              )
            })()}
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
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {unsavedChangesDialog}
  )
}
