import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { DateRange } from 'react-day-picker'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'
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
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useDialogCloseGuard } from '@/hooks/use-dialog-close-guard'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

function numOrUndefined(val: unknown): number | undefined {
  if (val === '' || val === undefined || val === null) return undefined
  if (typeof val === 'number' && Number.isNaN(val)) return undefined
  return val as number
}

const holidayRangeSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
})

const addHolidaySchema = z
  .object({
    title: z.string().trim().min(1, 'Holiday title is required'),
    dateRange: holidayRangeSchema,
    minStayNights: z.preprocess(
      numOrUndefined,
      z.number().int().min(1, 'Minimum stay must be at least 1 night'),
    ),
    maxStayNights: z.preprocess(
      numOrUndefined,
      z.number().int().min(1, 'Maximum stay must be at least 1 night').optional(),
    ),
    enabled: z.boolean(),
  })
  .refine((data) => data.dateRange.from != null && data.dateRange.to != null, {
    message: 'Start and end dates are required',
    path: ['dateRange'],
  })
  .refine(
    (data) => data.maxStayNights === undefined || data.maxStayNights >= data.minStayNights,
    { message: 'Maximum stay must be greater than or equal to minimum stay', path: ['maxStayNights'] },
  )

export type AddHolidayFormData = z.infer<typeof addHolidaySchema>

export type HolidayRule = {
  id: string
  title: string
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  min_stay_nights: number
  max_stay_nights?: number
  enabled: boolean
}

export type AddHolidayDialogSubmitPayload = HolidayRule

type AddHolidayDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: AddHolidayDialogSubmitPayload) => void
  openPeriodFrom?: string | null
  openPeriodUntil?: string | null
  initialValues?: Partial<HolidayRule> | null
  title?: string
  submitLabel?: string
}

function toLocalYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseLocalYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

const defaultValues: AddHolidayFormData = {
  title: '',
  dateRange: {},
  minStayNights: 1,
  maxStayNights: undefined,
  enabled: true,
}

export function AddHolidayDialog({
  open,
  onOpenChange,
  onSubmit: onFormSubmit,
  openPeriodFrom,
  openPeriodUntil,
  initialValues,
  title = 'Add holiday',
  submitLabel = 'Add holiday',
}: AddHolidayDialogProps) {
  const form = useForm<AddHolidayFormData>({
    resolver: zodResolver(addHolidaySchema),
    defaultValues,
  })

  const isSubmitting = form.formState.isSubmitting
  const cleanFormRef = useRef<string>("")
  const dateRange = form.watch('dateRange') as DateRange
  const enabled = form.watch('enabled')
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false)
  const openPeriodFromDate = openPeriodFrom ? parseLocalYmd(openPeriodFrom) : null
  const openPeriodUntilDate = openPeriodUntil ? parseLocalYmd(openPeriodUntil) : null

  const isOutsideOpenPeriod = (d: Date) =>
    !!openPeriodFromDate &&
    !!openPeriodUntilDate &&
    (d < openPeriodFromDate || d > openPeriodUntilDate)

  useEffect(() => {
    if (!open) return

    const from = initialValues?.start_date ? parseLocalYmd(initialValues.start_date) : null
    const to = initialValues?.end_date ? parseLocalYmd(initialValues.end_date) : null
    const initialDateRange = from && to ? { from, to } : {}

    form.reset({
      title: initialValues?.title ?? defaultValues.title,
      dateRange: initialDateRange,
      minStayNights: initialValues?.min_stay_nights ?? defaultValues.minStayNights,
      maxStayNights: initialValues?.max_stay_nights ?? defaultValues.maxStayNights,
      enabled: initialValues?.enabled ?? defaultValues.enabled,
    })
    const initialData = {
      title: initialValues?.title ?? defaultValues.title,
      dateRange: initialDateRange,
      minStayNights: initialValues?.min_stay_nights ?? defaultValues.minStayNights,
      maxStayNights: initialValues?.max_stay_nights ?? defaultValues.maxStayNights,
      enabled: initialValues?.enabled ?? defaultValues.enabled,
    }
    cleanFormRef.current = JSON.stringify(initialData)
  }, [open, form, initialValues])

  const isDirty = form.formState.isDirty && cleanFormRef.current !== ""

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({ isDirty, open, onOpenChange })

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset(defaultValues)
    onOpenChange(next)
  }

  const onSubmit = (data: AddHolidayFormData) => {
    const from = data.dateRange.from
    const to = data.dateRange.to
    if (!from || !to) return

    const base: HolidayRule = {
      id: initialValues?.id ?? uuidv4(),
      title: data.title.trim(),
      start_date: toLocalYmd(from),
      end_date: toLocalYmd(to),
      min_stay_nights: data.minStayNights,
      enabled: data.enabled,
    }

    onFormSubmit(data.maxStayNights === undefined ? base : { ...base, max_stay_nights: data.maxStayNights })
    form.reset(defaultValues)
    onOpenChange(false)
  }

  const titleError = form.formState.errors.title?.message
  const dateRangeError = form.formState.errors.dateRange?.message
  const minStayError = form.formState.errors.minStayNights?.message
  const maxStayError = form.formState.errors.maxStayNights?.message

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Configure a holiday reservation window and stay restrictions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="holidayTitle">Holiday title</Label>
            <Input
              id="holidayTitle"
              placeholder="e.g. Memorial Day Weekend"
              className={titleError ? 'border-destructive' : ''}
              {...form.register('title')}
            />
            {titleError && <p className="text-sm text-destructive">{String(titleError)}</p>}
          </div>

          <div className="space-y-2">
            <Label>Holiday duration</Label>
            <Popover open={isRangePickerOpen} onOpenChange={setIsRangePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex h-10 w-full items-center justify-between rounded-md border-2 bg-background px-3 py-2 text-sm',
                    'ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:ring-offset-0',
                    'border-input hover:border-primary',
                    dateRangeError ? 'border-destructive hover:border-destructive' : '',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CalendarIcon className={cn('h-4 w-4 shrink-0', dateRange?.from ? '' : 'text-muted-foreground')} />
                    <span className={cn('truncate', dateRange?.from ? 'text-foreground' : 'text-muted-foreground')}>
                      {!dateRange?.from
                        ? 'Select holiday dates'
                        : dateRange.to
                          ? `${format(dateRange.from, 'MMM d, yyyy')} – ${format(dateRange.to, 'MMM d, yyyy')}`
                          : format(dateRange.from, 'MMM d, yyyy')}
                    </span>
                  </span>
                  {dateRange?.from && dateRange?.to && (
                    <span className="text-[0.65rem] font-extrabold uppercase tracking-widest">
                      Set
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto min-w-[20rem] overflow-hidden rounded-2xl border-2 border-border p-0 shadow-lg"
                align="start"
              >
                <div className="p-3">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      form.setValue('dateRange', range ?? {}, { shouldDirty: true, shouldValidate: true })
                    }}
                    disabled={isOutsideOpenPeriod}
                    numberOfMonths={1}
                    weekStartsOn={1}
                    defaultMonth={dateRange?.from ?? new Date()}
                  />
                </div>
                <div className="flex items-center justify-between border-t border-border px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('dateRange', {}, { shouldDirty: true, shouldValidate: true })
                    }}
                    className="text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Clear dates
                  </button>
                  <button
                    type="button"
                    disabled={!dateRange?.from || !dateRange?.to}
                    onClick={() => setIsRangePickerOpen(false)}
                    className={cn(
                      'rounded-xl px-5 py-1.5 text-xs font-bold shadow-sm transition-all',
                      dateRange?.from && dateRange?.to
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
                        : 'cursor-not-allowed bg-primary/30 text-primary-foreground',
                    )}
                  >
                    Confirm
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            {dateRangeError && <p className="text-sm text-destructive">{String(dateRangeError)}</p>}
            {form.formState.errors.dateRange?.from?.message && (
              <p className="text-sm text-destructive">{String(form.formState.errors.dateRange.from.message)}</p>
            )}
            {form.formState.errors.dateRange?.to?.message && (
              <p className="text-sm text-destructive">{String(form.formState.errors.dateRange.to.message)}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minStayNights">Minimum stay (nights)</Label>
              <Input
                id="minStayNights"
                type="number"
                min={1}
                placeholder="e.g. 2"
                className={minStayError ? 'border-destructive' : ''}
                {...form.register('minStayNights', { valueAsNumber: true })}
              />
              {minStayError && <p className="text-sm text-destructive">{String(minStayError)}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxStayNights">Max stay (optional)</Label>
              <Input
                id="maxStayNights"
                type="number"
                min={1}
                placeholder="e.g. 7"
                className={maxStayError ? 'border-destructive' : ''}
                {...form.register('maxStayNights', { valueAsNumber: true })}
              />
              {maxStayError && <p className="text-sm text-destructive">{String(maxStayError)}</p>}
            </div>
          </div>

          {/* <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">
                Toggle whether this holiday rule is active.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => form.setValue('enabled', checked, { shouldDirty: true })}
            />
          </div> */}

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
