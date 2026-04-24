'use client'

/**
 * Booking Date Range Picker — v4
 *
 * Matches the screenshot exactly:
 *  • NO header strip inside the dropdown
 *  • Range-middle days: bold blue text, NO background
 *  • Start/end days: filled blue circle, white text
 *  • Nav arrows top-right, square blue buttons
 *  • Site palette: dark green trigger label, sky-blue accents
 *  • Popup NEVER auto-closes — only on Confirm or outside click
 */

import * as React from 'react'
import { addDays, format, isToday } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DayPicker,
  type DayButton,
  getDefaultClassNames,
  type DateRange,
} from 'react-day-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/* ── Brand palette ───────────────────────────────────────── */
const C = {
  green: '#2D5A27',
  greenDark: '#1e3d1a',
  greenLight: '#e7f2e6',
  greenSoft: '#f2f7f1',
  text: '#1a202c',
  muted: '#9ca3af',
  border: '#e2e8f0',
}

/* ── Types ───────────────────────────────────────────────── */
export type DateRangeValue = DateRange | undefined

export type BookingDateRangePickerVariant = 'guest' | 'dashboard'

export interface BookingDateRangePickerProps {
  label?: string
  value: DateRangeValue
  onChange: (range: DateRangeValue) => void
  /** `guest` = campground green; `dashboard` = app primary (e.g. reservations UI) */
  variant?: BookingDateRangePickerVariant
  sameDayBookingEnabled?: boolean
  blackoutDates?: string[]
  bookingWindowDays?: number
  advanceNoticeDays?: number
  openPeriodFrom?: string | null
  openPeriodUntil?: string | null
  /**
   * When true, only `blackoutDates` can disable days (e.g. activity / report filters).
   * Booking rules, past-date blocks, windows, and open period are skipped.
   */
  allowPastDates?: boolean
  /**
   * `start` = panel’s left edge with the trigger (default).
   * `end` = panel’s right edge with the trigger — avoids clipping when the trigger is on the viewport edge.
   */
  dropdownAlign?: 'start' | 'end'
  disabled?: boolean
  className?: string
  numberOfMonths?: number
}

/* ── Helpers ─────────────────────────────────────────────── */
function isDateDisabled(
  date: Date,
  sameDayOk: boolean,
  blackout: string[],
  bookingWindowDays?: number,
  advanceNoticeDays?: number,
  openPeriodFrom?: string | null,
  openPeriodUntil?: string | null,
  allowPastDates?: boolean,
) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  if (allowPastDates) {
    return blackout.includes(format(date, 'yyyy-MM-dd'))
  }
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  if (d < t) return true

  const minDaysBySameDay = sameDayOk ? 0 : 1
  const minDaysByAdvanceNotice =
    typeof advanceNoticeDays === 'number' && Number.isFinite(advanceNoticeDays)
      ? Math.max(0, Math.floor(advanceNoticeDays))
      : 0
  const minDays = Math.max(minDaysBySameDay, minDaysByAdvanceNotice)
  if (d < addDays(t, minDays)) return true

  if (typeof bookingWindowDays === 'number' && Number.isFinite(bookingWindowDays)) {
    const windowDays = Math.max(0, Math.floor(bookingWindowDays))
    const maxDate = addDays(t, windowDays)
    if (d > maxDate) return true
  }

  const from = parseLocalYmd(openPeriodFrom ?? '')
  const until = parseLocalYmd(openPeriodUntil ?? '')
  if (from && until && (d < from || d > until)) return true

  return blackout.includes(format(date, 'yyyy-MM-dd'))
}

function triggerText(v: DateRangeValue) {
  if (!v?.from) return 'Select dates'
  if (!v.to) return format(v.from, 'MMM d')
  return `${format(v.from, 'MMM d')} – ${format(v.to, 'MMM d, yyyy')}`
}

function parseLocalYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function blackoutTriggerText(ymdStrings: string[]) {
  if (ymdStrings.length === 0) return 'Select dates'
  if (ymdStrings.length === 1) return ymdStrings[0]
  return `${ymdStrings.length} dates selected`
}

function expandDateRangeToYmdStrings(from: Date, to: Date): string[] {
  const a = new Date(from)
  a.setHours(0, 0, 0, 0)
  const b = new Date(to)
  b.setHours(0, 0, 0, 0)

  const start = a <= b ? a : b
  const end = a <= b ? b : a

  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push(format(d, 'yyyy-MM-dd'))
  }
  return out
}

export type BlackoutDatesPickerProps = {
  label?: string
  /** YYYY-MM-DD strings, sorted */
  value: string[]
  onChange: (dates: string[]) => void
  variant?: BookingDateRangePickerVariant
  className?: string
  numberOfMonths?: number
  openPeriodFrom?: string | null
  openPeriodUntil?: string | null
}

/* ── Day button ──────────────────────────────────────────── */
function StyledDayButton({
  variant,
  day,
  modifiers,
  className,
  ...props
}: React.ComponentProps<typeof DayButton> & { variant: BookingDateRangePickerVariant }) {
  const isEndpoint = modifiers.range_start || modifiers.range_end
  const isMiddle = modifiers.range_middle
  const isSingle = modifiers.selected && !isMiddle && !isEndpoint
  const isDraftFilled = isEndpoint || isSingle
  const isBlackoutSelected = Boolean((modifiers as unknown as { blackout_selected?: boolean }).blackout_selected)
  const isBlackoutFilled = isBlackoutSelected && !isDraftFilled && !isMiddle

  const todayDot = isToday(day.date) && !isDraftFilled && !isBlackoutFilled
  const isDashboard = variant === 'dashboard'

  return (
    <button
      {...props}
      className={cn(
        'relative flex items-center justify-center w-full h-full aspect-square',
        'text-[0.9rem] outline-none transition-all duration-100 border-0 appearance-none',
        isDashboard ? 'focus-visible:ring-2 focus-visible:ring-primary' : 'focus-visible:ring-2 focus-visible:ring-[#2D5A27] dark:focus-visible:ring-emerald-500',

        !isDraftFilled && !isBlackoutFilled && !isMiddle && cn(
          'rounded-none font-normal',
          isDashboard ? 'text-foreground hover:bg-muted' : 'text-[#1a202c] hover:bg-[#f2f7f1] dark:text-foreground dark:hover:bg-muted',
        ),

        isMiddle && cn(
          'rounded-none font-semibold',
          isDashboard
            ? 'text-primary bg-primary/10 hover:bg-primary/10'
            : 'text-[#2D5A27] bg-[#e7f2e6] hover:bg-[#e7f2e6] dark:text-emerald-400 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/50',
        ),

        isDraftFilled && cn(
          'rounded-none border-0 font-bold shadow-sm',
          isDashboard ? 'bg-primary text-primary-foreground' : 'bg-[#2D5A27] text-white dark:bg-emerald-800',
        ),

        isBlackoutFilled && cn(
          'rounded-none border-0 font-bold shadow-sm',
          isDashboard
            ? 'bg-primary/10 text-primary hover:bg-primary/10'
            : 'bg-[#2D5A27]/10 text-[#2D5A27] dark:bg-emerald-950/40 dark:text-emerald-200 hover:bg-[#2D5A27]/10',
        ),

        className,
      )}
    >
      {props.children}
      {todayDot && (
        <span
          className={cn(
            'absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full',
            isDashboard ? 'bg-primary' : '',
          )}
          style={isDashboard ? undefined : { background: C.green }}
        />
      )}
    </button>
  )
}

/* ── Inner calendar ──────────────────────────────────────── */
function StyledCalendar({
  variant,
  className,
  ...props
}: React.ComponentProps<typeof DayPicker> & { variant: BookingDateRangePickerVariant }) {
  const dc = getDefaultClassNames()
  const isDashboard = variant === 'dashboard'
  const navBtn = isDashboard
    ? 'flex items-center justify-center w-7 h-7 rounded-[4px] bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all aria-disabled:opacity-30 aria-disabled:pointer-events-none'
    : 'flex items-center justify-center w-7 h-7 rounded-[4px] bg-[#2D5A27] text-white hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900 active:scale-95 transition-all aria-disabled:opacity-30 aria-disabled:pointer-events-none'

  return (
    <DayPicker
      {...props}
      className={cn('select-none w-full', className)}
      classNames={{
        root: cn('w-full', dc.root),
        months: cn('flex flex-col', dc.months),
        month: cn('relative flex flex-col gap-1 w-full', dc.month),

        nav: cn('absolute right-3 top-2 z-10 flex h-8 items-center gap-1 pointer-events-auto', dc.nav),
        button_previous: cn(navBtn, dc.button_previous),
        button_next: cn(navBtn, dc.button_next),

        month_caption: cn('relative flex items-center h-10 pr-20 pt-1', dc.month_caption),
        caption_label: cn(
          'pointer-events-none text-[1.1rem] font-bold',
          isDashboard ? 'text-foreground' : 'text-[#1a202c] dark:text-foreground',
          dc.caption_label,
        ),

        weekdays: cn('flex', dc.weekdays),
        weekday: cn(
          'flex-1 text-center text-[0.72rem] font-semibold uppercase tracking-wider pb-1',
          isDashboard ? 'text-muted-foreground' : 'text-[#9ca3af] dark:text-muted-foreground',
          dc.weekday,
        ),

        /* 1px gutters between rows only */
        week: cn('flex w-full mt-px first:mt-0', dc.week),

        /* Day cell — keep columns flush (no horizontal gap) */
        day: cn('relative flex-1 aspect-square p-0 text-center', dc.day),
        range_start: dc.range_start,
        range_middle: dc.range_middle,
        range_end: dc.range_end,

        today: cn('font-extrabold', dc.today),
        outside: cn('opacity-25', dc.outside),
        disabled: cn('opacity-20 pointer-events-none', dc.disabled),
        hidden: cn('invisible', dc.hidden),
        table: 'w-full border-collapse',
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left'
            ? <ChevronLeft className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />,
        DayButton: (dayButtonProps) => <StyledDayButton {...dayButtonProps} variant={variant} />,
      }}
    />
  )
}

/* ── Main export ─────────────────────────────────────────── */
export function BookingDateRangePicker({
  label = 'CHECK-IN & CHECK-OUT',
  value,
  onChange,
  variant = 'guest',
  sameDayBookingEnabled = true,
  blackoutDates = [],
  bookingWindowDays,
  advanceNoticeDays,
  openPeriodFrom,
  openPeriodUntil,
  allowPastDates = false,
  dropdownAlign = 'start',
  disabled = false,
  className,
  numberOfMonths = 1,
}: BookingDateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  /* Close on outside click only */
  React.useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const disabledFn = React.useCallback(
    (d: Date) =>
      isDateDisabled(
        d,
        sameDayBookingEnabled,
        blackoutDates,
        bookingWindowDays,
        advanceNoticeDays,
        openPeriodFrom,
        openPeriodUntil,
        allowPastDates,
      ),
    [
      sameDayBookingEnabled,
      blackoutDates,
      bookingWindowDays,
      advanceNoticeDays,
      openPeriodFrom,
      openPeriodUntil,
      allowPastDates,
    ],
  )

  const hasValue = Boolean(value?.from)
  const hasRange = Boolean(value?.from && value?.to)
  const isDashboard = variant === 'dashboard'
  const alignEnd = dropdownAlign === 'end'

  return (
    <div ref={ref} className={cn('relative w-full space-y-2', className)}>

      {label && (
        <p
          className={cn(
            'm-0 text-sm font-medium',
            isDashboard ? '' : 'text-[#2D5A27] dark:text-emerald-400',
          )}
        >
          {label}
        </p>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border-2 bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
          isDashboard
            ? open
              ? 'border-primary'
              : 'border-input hover:border-primary'
            : open
              ? 'border-[#2D5A27] dark:border-emerald-500'
              : 'border-input hover:border-[#2D5A27] dark:hover:border-emerald-500',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span className="flex items-center gap-2">
          <CalendarIcon
            className={cn(
              'h-4 w-4 shrink-0',
              hasValue
                ? isDashboard
                  ? ''
                  : 'text-[#2D5A27] dark:text-emerald-400'
                : 'text-muted-foreground',
            )}
          />
          <span className={cn('truncate', hasValue ? 'text-foreground' : 'text-muted-foreground')}>
            {triggerText(value)}
          </span>
        </span>
        {hasValue && (
          <span
            className={cn(
              'text-[0.65rem] font-extrabold uppercase tracking-widest',
              isDashboard ? '' : 'text-[#2D5A27] dark:text-emerald-400',
            )}
          >
            SET
          </span>
        )}
      </button>

      <div
        className={cn(
          'absolute top-full z-50 mt-1.5 min-w-[20rem]',
          alignEnd
            ? 'right-0 left-auto w-max max-w-[min(calc(100vw-1.5rem),24rem)]'
            : 'left-0 w-full',
          'rounded-2xl border shadow-lg',
          isDashboard
            ? 'bg-popover text-popover-foreground border-border'
            : 'bg-white border-[#e2e8f0] shadow-2xl shadow-black/10 dark:bg-popover dark:text-popover-foreground dark:border-border',
          alignEnd ? 'origin-top-right' : 'origin-top',
          'transition-all duration-200',
          open
            ? 'scale-100 opacity-100 pointer-events-auto'
            : 'scale-95 opacity-0 pointer-events-none',
        )}
      >
        <div className="px-4 pt-3 pb-2">
          <StyledCalendar
            variant={variant}
            mode="range"
            selected={value}
            onSelect={(range) => onChange(range)}
            disabled={disabledFn}
            defaultMonth={value?.from ?? new Date()}
            numberOfMonths={numberOfMonths}
            weekStartsOn={1}
          />
        </div>

        <div
          className={cn(
            'flex items-center justify-between border-t px-4 py-3',
            isDashboard ? 'border-border' : 'border-[#e2e8f0] dark:border-border',
          )}
        >
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear dates
          </button>
          <button
            type="button"
            disabled={!hasRange}
            onClick={() => setOpen(false)}
            className={cn(
              'rounded-xl px-5 py-1.5 text-xs font-bold transition-all',
              isDashboard
                ? hasRange
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-sm'
                  : 'bg-primary/30 text-primary-foreground cursor-not-allowed'
                : hasRange
                  ? 'text-white bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900 active:scale-95 shadow-sm'
                  : 'text-white bg-[#2D5A27]/30 dark:bg-emerald-800/40 cursor-not-allowed',
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

function singleDateTriggerText(value: Date | undefined) {
  if (!value) return 'Select date'
  return format(value, 'MMM d, yyyy')
}

export interface BookingSingleDatePickerProps {
  label?: string
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  variant?: BookingDateRangePickerVariant
  sameDayBookingEnabled?: boolean
  blackoutDates?: string[]
  bookingWindowDays?: number
  advanceNoticeDays?: number
  openPeriodFrom?: string | null
  openPeriodUntil?: string | null
  allowPastDates?: boolean
  dropdownAlign?: 'start' | 'end'
  disabled?: boolean
  className?: string
  numberOfMonths?: number
}

/**
 * Single-day picker using the same {@link StyledCalendar} chrome as {@link BookingDateRangePicker}
 * (dashboard / guest variants, Clear / Confirm, week starts Monday).
 */
export function BookingSingleDatePicker({
  label = 'Date',
  value,
  onChange,
  variant = 'dashboard',
  sameDayBookingEnabled = true,
  blackoutDates = [],
  bookingWindowDays,
  advanceNoticeDays,
  openPeriodFrom,
  openPeriodUntil,
  allowPastDates = true,
  dropdownAlign = 'start',
  disabled = false,
  className,
  numberOfMonths = 1,
}: BookingSingleDatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const disabledFn = React.useCallback(
    (d: Date) =>
      isDateDisabled(
        d,
        sameDayBookingEnabled,
        blackoutDates,
        bookingWindowDays,
        advanceNoticeDays,
        openPeriodFrom,
        openPeriodUntil,
        allowPastDates,
      ),
    [
      sameDayBookingEnabled,
      blackoutDates,
      bookingWindowDays,
      advanceNoticeDays,
      openPeriodFrom,
      openPeriodUntil,
      allowPastDates,
    ],
  )

  const hasValue = Boolean(value)
  const isDashboard = variant === 'dashboard'
  const alignEnd = dropdownAlign === 'end'

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <div className={cn('w-full space-y-2', className)}>
        {label && (
          <p
            className={cn(
              'm-0 text-sm font-medium',
              isDashboard ? '' : 'text-[#2D5A27] dark:text-emerald-400',
            )}
          >
            {label}
          </p>
        )}

        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border-2 bg-background px-3 py-2 text-sm',
              'ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
              isDashboard
                ? 'border-input hover:border-primary data-[state=open]:border-primary'
                : 'border-input hover:border-[#2D5A27] data-[state=open]:border-[#2D5A27] dark:hover:border-emerald-500 dark:data-[state=open]:border-emerald-500',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarIcon
                className={cn(
                  'h-4 w-4 shrink-0',
                  hasValue
                    ? isDashboard
                      ? ''
                      : 'text-[#2D5A27] dark:text-emerald-400'
                    : 'text-muted-foreground',
                )}
              />
              <span className={cn('truncate', hasValue ? 'text-foreground' : 'text-muted-foreground')}>
                {singleDateTriggerText(value)}
              </span>
            </span>
            {hasValue && (
              <span
                className={cn(
                  'text-[0.65rem] font-extrabold uppercase tracking-widest',
                  isDashboard ? '' : 'text-[#2D5A27] dark:text-emerald-400',
                )}
              >
                SET
              </span>
            )}
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent
        side="top"
        align={alignEnd ? 'end' : 'start'}
        sideOffset={6}
        avoidCollisions={false}
        collisionPadding={12}
        className={cn(
          'z-[100] w-auto min-w-[20rem] max-w-[min(calc(100vw-2rem),24rem)] rounded-2xl border p-0 shadow-lg',
          isDashboard
            ? 'border-border bg-popover text-popover-foreground'
            : 'border-[#e2e8f0] bg-white text-popover-foreground shadow-2xl shadow-black/10 dark:border-border dark:bg-popover',
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-4 pt-3 pb-2">
          <StyledCalendar
            variant={variant}
            mode="single"
            selected={value}
            onSelect={(d) => onChange(d)}
            disabled={disabledFn}
            defaultMonth={value ?? new Date()}
            numberOfMonths={numberOfMonths}
            weekStartsOn={1}
          />
        </div>

        <div
          className={cn(
            'flex items-center justify-between border-t px-4 py-3',
            isDashboard ? 'border-border' : 'border-[#e2e8f0] dark:border-border',
          )}
        >
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
          >
            Clear dates
          </button>
          <button
            type="button"
            disabled={!hasValue}
            onClick={() => setOpen(false)}
            className={cn(
              'rounded-xl px-5 py-1.5 text-xs font-bold transition-all',
              isDashboard
                ? hasValue
                  ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95'
                  : 'cursor-not-allowed bg-primary/30 text-primary-foreground'
                : hasValue
                  ? 'bg-[#2D5A27] text-white shadow-sm hover:bg-[#1e3d1a] active:scale-95 dark:bg-emerald-800 dark:hover:bg-emerald-900'
                  : 'cursor-not-allowed bg-[#2D5A27]/30 text-white dark:bg-emerald-800/40',
            )}
          >
            Confirm
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Multi-date picker using the same dashboard calendar chrome as {@link BookingDateRangePicker}
 * (popover, nav buttons, Clear / Confirm). For site or property blackout date lists.
 */
export function BlackoutDatesPicker({
  label = 'Blackout dates',
  value,
  onChange,
  variant = 'dashboard',
  className,
  numberOfMonths = 1,
  openPeriodFrom,
  openPeriodUntil,
}: BlackoutDatesPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const unmountTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draftRange, setDraftRange] = React.useState<DateRangeValue>(undefined)

  React.useEffect(() => {
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current)
    if (open) {
      setMounted(true)
    } else {
      unmountTimerRef.current = setTimeout(() => setMounted(false), 200)
    }
    return () => {
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setDraftRange(undefined)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const selectedDates = React.useMemo(
    () => value.map(parseLocalYmd).filter((d): d is Date => d !== null),
    [value],
  )

  const blackoutDisabledFn = React.useCallback((d: Date) => {
    const day = new Date(d)
    day.setHours(0, 0, 0, 0)
    const from = parseLocalYmd(openPeriodFrom ?? '')
    const until = parseLocalYmd(openPeriodUntil ?? '')
    if (from && until && (day < from || day > until)) return true
    return false
  }, [openPeriodFrom, openPeriodUntil])

  React.useEffect(() => {
    if (!open) return
    setDraftRange(undefined)
  }, [open])

  const hasValue = value.length > 0
  const hasDraftRange = Boolean(draftRange?.from && draftRange?.to)
  const isDashboard = variant === 'dashboard'

  const applyDraftRange = React.useCallback(() => {
    if (!draftRange?.from || !draftRange?.to) return

    const expanded = expandDateRangeToYmdStrings(draftRange.from, draftRange.to)
    const next = [...new Set([...value, ...expanded])].sort()

    onChange(next)
    setDraftRange(undefined)
    setOpen(false)
  }, [draftRange?.from, draftRange?.to, onChange, value])

  return (
    <div ref={ref} className={cn('relative w-full space-y-2', className)}>
      {label && (
        <p className={cn('m-0 text-sm font-medium', isDashboard ? '' : 'text-[#2D5A27] dark:text-emerald-400')}>
          {label}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border-2 bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:ring-offset-0',
          isDashboard
            ? open
              ? 'border-primary'
              : 'border-input hover:border-primary'
            : open
              ? 'border-[#2D5A27] dark:border-emerald-500'
              : 'border-input hover:border-[#2D5A27] dark:hover:border-emerald-500',
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarIcon
            className={cn(
              'h-4 w-4 shrink-0',
              hasValue
                ? isDashboard
                  ? ''
                  : 'text-[#2D5A27] dark:text-emerald-400'
                : 'text-muted-foreground',
            )}
          />
          <span className={cn('truncate', hasValue ? 'text-foreground' : 'text-muted-foreground')}>
            {blackoutTriggerText(value)}
          </span>
        </span>
        {hasValue && (
          <span
            className={cn(
              'text-[0.65rem] font-extrabold uppercase tracking-widest shrink-0',
              isDashboard ? '' : 'text-[#2D5A27] dark:text-emerald-400',
            )}
          >
            SET
          </span>
        )}
      </button>

      {mounted && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-1.5',
            /* Cap width so day cells stay ~32–36px; w-full was stretching the grid to full card width */
            'w-[min(17rem,calc(100vw-2rem))]',
            'rounded-2xl border shadow-lg',
            isDashboard
              ? 'bg-popover text-popover-foreground border-border'
              : 'bg-white border-[#e2e8f0] shadow-2xl shadow-black/10 dark:bg-popover dark:text-popover-foreground dark:border-border',
            'origin-top transition-all duration-200',
            open ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none',
          )}
        >
          <div className="px-2.5 pt-2 pb-1.5">
            <StyledCalendar
              variant={variant}
              mode="range"
              selected={draftRange}
              onSelect={(range) => setDraftRange(range)}
              modifiers={{ blackout_selected: selectedDates }}
              disabled={blackoutDisabledFn}
              defaultMonth={draftRange?.from ?? selectedDates[0] ?? new Date()}
              numberOfMonths={numberOfMonths}
              weekStartsOn={1}
              className="text-[0.8125rem]"
            />
          </div>

          <div
            className={cn(
              'flex items-center justify-between border-t px-2.5 py-2',
              isDashboard ? 'border-border' : 'border-[#e2e8f0] dark:border-border',
            )}
          >
            <button
              type="button"
              onClick={() => {
                onChange([])
                setDraftRange(undefined)
              }}
              className="text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear dates
            </button>
            <button
              type="button"
              disabled={!hasDraftRange}
              onClick={applyDraftRange}
              className={cn(
                'rounded-xl px-5 py-1.5 text-xs font-bold transition-all',
                isDashboard
                  ? hasDraftRange
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-sm'
                    : 'bg-primary/30 text-primary-foreground cursor-not-allowed'
                  : hasDraftRange
                    ? 'text-white bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900 active:scale-95 shadow-sm'
                    : 'text-white bg-[#2D5A27]/30 dark:bg-emerald-800/40 cursor-not-allowed',
              )}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}