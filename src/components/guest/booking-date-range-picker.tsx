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
import { format, isToday, differenceInCalendarDays } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DayPicker,
  type DayButton,
  getDefaultClassNames,
  type DateRange,
} from 'react-day-picker'
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

export interface BookingDateRangePickerProps {
  label?: string
  value: DateRangeValue
  onChange: (range: DateRangeValue) => void
  sameDayBookingEnabled?: boolean
  blackoutDates?: string[]
  disabled?: boolean
  className?: string
  numberOfMonths?: number
}

/* ── Helpers ─────────────────────────────────────────────── */
function isDateDisabled(date: Date, sameDayOk: boolean, blackout: string[]) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  if (d < t) return true
  if (!sameDayOk && d.getTime() === t.getTime()) return true
  return blackout.includes(format(date, 'yyyy-MM-dd'))
}

function triggerText(v: DateRangeValue) {
  if (!v?.from) return 'Select dates'
  if (!v.to) return format(v.from, 'MMM d')
  return `${format(v.from, 'MMM d')} – ${format(v.to, 'MMM d, yyyy')}`
}

/* ── Day button ──────────────────────────────────────────── */
function StyledDayButton({ day, modifiers, className, ...props }: React.ComponentProps<typeof DayButton>) {
  const isEndpoint = modifiers.range_start || modifiers.range_end
  const isMiddle = modifiers.range_middle
  const isSingle = modifiers.selected && !isMiddle && !isEndpoint
  const filled = isEndpoint || isSingle
  const todayDot = isToday(day.date) && !filled

  return (
    <button
      {...props}
      className={cn(
        'relative flex items-center justify-center w-full h-full aspect-square',
        'text-[0.9rem] outline-none transition-all duration-100 border-0 appearance-none',
        'focus-visible:ring-2 focus-visible:ring-[#2D5A27]',

        /* Default */
        !filled && !isMiddle && 'rounded-none font-normal text-[#1a202c] hover:bg-[#f2f7f1]',

        /* In-range (backdrop): continuous square strip */
        isMiddle && 'rounded-none font-semibold text-[#2D5A27] bg-[#e7f2e6] hover:bg-[#e7f2e6]',

        /* Endpoint / single: filled green, white text */
        filled && 'rounded-none border-0 bg-[#2D5A27] text-white font-bold shadow-sm',

        className,
      )}
    >
      {props.children}
      {todayDot && (
        <span
          className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full"
          style={{ background: C.green }}
        />
      )}
    </button>
  )
}

/* ── Inner calendar ──────────────────────────────────────── */
function StyledCalendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  const dc = getDefaultClassNames()
  return (
    <DayPicker
      {...props}
      className={cn('select-none w-full', className)}
      classNames={{
        root: cn('w-full', dc.root),
        months: cn('flex flex-col', dc.months),
        month: cn('relative flex flex-col gap-1 w-full', dc.month),

        /* Force arrows to live on the same row as month/year */
        nav: cn('absolute right-3 top-2 z-10 flex h-8 items-center gap-1 pointer-events-auto', dc.nav),
        button_previous: cn(
          'flex items-center justify-center w-7 h-7 rounded-[4px] bg-[#2D5A27] text-white',
          'hover:bg-[#1e3d1a] active:scale-95 transition-all',
          'aria-disabled:opacity-30 aria-disabled:pointer-events-none',
          dc.button_previous,
        ),
        button_next: cn(
          'flex items-center justify-center w-7 h-7 rounded-[4px] bg-[#2D5A27] text-white',
          'hover:bg-[#1e3d1a] active:scale-95 transition-all',
          'aria-disabled:opacity-30 aria-disabled:pointer-events-none',
          dc.button_next,
        ),

        month_caption: cn('relative flex items-center h-10 pr-20 pt-1', dc.month_caption),
        // Ensure the label doesn't block nav button clicks (nav is absolutely positioned on top-right).
        caption_label: cn('pointer-events-none text-[1.1rem] font-bold text-[#1a202c]', dc.caption_label),

        weekdays: cn('flex', dc.weekdays),
        weekday: cn(
          'flex-1 text-center text-[0.72rem] font-semibold uppercase tracking-wider text-[#9ca3af] pb-1',
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
        DayButton: StyledDayButton,
      }}
    />
  )
}

/* ── Main export ─────────────────────────────────────────── */
export function BookingDateRangePicker({
  label = 'CHECK-IN & CHECK-OUT',
  value,
  onChange,
  sameDayBookingEnabled = true,
  blackoutDates = [],
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
    (d: Date) => isDateDisabled(d, sameDayBookingEnabled, blackoutDates),
    [sameDayBookingEnabled, blackoutDates],
  )

  const hasValue = Boolean(value?.from)
  const hasRange = Boolean(value?.from && value?.to)

  return (
    <div ref={ref} className={cn('relative w-full space-y-2', className)}>

      {/* Label — no margin so row height matches other filters */}
      {label && (
        <p className="m-0 text-sm font-medium text-[#2D5A27]">
          {label}
        </p>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={cn(
          // Match other filters: h-10, border-2, same spacing
          'flex h-10 w-full items-center justify-between rounded-md border-2 bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
          open ? 'border-[#2D5A27]' : 'border-input hover:border-[#2D5A27]',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span className="flex items-center gap-2">
          <CalendarIcon className={cn('h-4 w-4 shrink-0', hasValue ? 'text-[#2D5A27]' : 'text-[#9ca3af]')} />
          <span className={cn('truncate', hasValue ? 'text-[#111827]' : 'text-[#9ca3af]')}>
            {triggerText(value)}
          </span>
        </span>
        {hasValue && (
          <span className="text-[0.65rem] font-extrabold uppercase tracking-widest text-[#2D5A27]">
            SET
          </span>
        )}
      </button>

      {/* Dropdown — no header strip */}
      <div
        className={cn(
          'absolute left-0 top-full z-50 mt-1.5 w-full min-w-[20rem]',
          'rounded-2xl bg-white border border-[#e2e8f0] shadow-2xl shadow-black/10',
          'origin-top transition-all duration-200',
          open
            ? 'scale-100 opacity-100 pointer-events-auto'
            : 'scale-95 opacity-0 pointer-events-none',
        )}
      >
        {/* Calendar — NO onSelect auto-close */}
        <div className="px-4 pt-3 pb-2">
          <StyledCalendar
            mode="range"
            selected={value}
            onSelect={(range) => onChange(range)}   /* never closes popup */
            disabled={disabledFn}
            defaultMonth={value?.from ?? new Date()}
            numberOfMonths={numberOfMonths}
            weekStartsOn={1}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e2e8f0] px-4 py-3">
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-xs font-semibold text-[#9ca3af] hover:text-red-400 transition-colors"
          >
            Clear dates
          </button>
          <button
            type="button"
            disabled={!hasRange}
            onClick={() => setOpen(false)}
            className={cn(
              'rounded-xl px-5 py-1.5 text-xs font-bold text-white transition-all',
              hasRange
                ? 'bg-[#2D5A27] hover:bg-[#1e3d1a] active:scale-95 shadow-sm'
                : 'bg-[#2D5A27]/30 cursor-not-allowed',
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}