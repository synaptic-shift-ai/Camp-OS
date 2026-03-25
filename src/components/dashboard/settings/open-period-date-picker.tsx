'use client'

/**
 * Single-date picker styled like the dashboard booking flow (Step 1 calendar):
 * thick border trigger, rounded popover, primary square nav buttons, Clear + Confirm footer.
 */

import * as React from 'react'
import { format, isToday } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DayPicker,
  type DayButton,
  getDefaultClassNames,
} from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function DashboardDayButton({
  day,
  modifiers,
  className,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const isSingle = modifiers.selected && !modifiers.range_middle
  const filled = Boolean(isSingle || modifiers.range_start || modifiers.range_end)
  const todayDot = isToday(day.date) && !filled

  return (
    <button
      type="button"
      {...props}
      className={cn(
        'relative flex h-full w-full aspect-square items-center justify-center',
        'border-0 text-[0.9rem] outline-none transition-all duration-100 appearance-none',
        'focus-visible:ring-2 focus-visible:ring-primary',
        !filled &&
          !modifiers.range_middle &&
          'rounded-none font-normal text-foreground hover:bg-muted',
        modifiers.range_middle &&
          'rounded-none bg-primary/10 font-semibold text-primary hover:bg-primary/10',
        filled &&
          'rounded-none border-0 bg-primary font-bold text-primary-foreground shadow-sm',
        className,
      )}
    >
      {props.children}
      {todayDot && (
        <span className="absolute bottom-[3px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-primary" />
      )}
    </button>
  )
}

function DashboardSingleMonthCalendar({
  className,
  selected,
  onSelect,
  defaultMonth,
}: {
  className?: string
  selected: Date | undefined
  onSelect: (d: Date | undefined) => void
  defaultMonth?: Date
}) {
  const dc = getDefaultClassNames()
  const navBtn =
    'flex h-7 w-7 items-center justify-center rounded-[4px] bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 aria-disabled:pointer-events-none aria-disabled:opacity-30'

  return (
    <DayPicker
      mode="single"
      weekStartsOn={1}
      selected={selected}
      onSelect={onSelect}
      defaultMonth={defaultMonth ?? selected ?? new Date()}
      className={cn('w-full select-none', className)}
      classNames={{
        root: cn('w-full', dc.root),
        months: cn('flex flex-col', dc.months),
        month: cn('relative flex w-full flex-col gap-1', dc.month),
        nav: cn(
          'pointer-events-auto absolute right-3 top-2 z-10 flex h-8 items-center gap-1',
          dc.nav,
        ),
        button_previous: cn(navBtn, dc.button_previous),
        button_next: cn(navBtn, dc.button_next),
        month_caption: cn('relative flex h-10 items-center pr-20 pt-1', dc.month_caption),
        caption_label: cn(
          'pointer-events-none text-[1.1rem] font-bold text-foreground',
          dc.caption_label,
        ),
        weekdays: cn('flex', dc.weekdays),
        weekday: cn(
          'flex-1 pb-1 text-center text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground',
          dc.weekday,
        ),
        week: cn('mt-px flex w-full first:mt-0', dc.week),
        day: cn('relative flex-1 aspect-square p-0 text-center', dc.day),
        today: cn('font-extrabold', dc.today),
        outside: cn('opacity-25', dc.outside),
        disabled: cn('pointer-events-none opacity-20', dc.disabled),
        hidden: cn('invisible', dc.hidden),
        table: 'w-full border-collapse',
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          ),
        DayButton: DashboardDayButton,
      }}
    />
  )
}

export type OpenPeriodDatePickerProps = {
  id?: string
  value: Date | undefined
  onChange: (d: Date | undefined) => void
  placeholder?: string
}

export function OpenPeriodDatePicker({
  id,
  value,
  onChange,
  placeholder = 'Select dates',
}: OpenPeriodDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const hasValue = Boolean(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border-2 bg-background px-3 py-2 text-sm',
            'ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:ring-offset-0',
            open ? 'border-primary' : 'border-input hover:border-primary',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarIcon
              className={cn('h-4 w-4 shrink-0', hasValue ? '' : 'text-muted-foreground')}
            />
            <span
              className={cn(
                'truncate',
                hasValue ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {hasValue && value ? format(value, 'MMM d, yyyy') : placeholder}
            </span>
          </span>
          {hasValue && (
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
        <div className="px-4 pb-2 pt-3">
          <DashboardSingleMonthCalendar
            selected={value}
            onSelect={onChange}
            {...(value ? { defaultMonth: value } : {})}
          />
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onChange(undefined)
            }}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
          >
            Clear dates
          </button>
          <button
            type="button"
            disabled={!hasValue}
            onClick={() => setOpen(false)}
            className={cn(
              'rounded-xl px-5 py-1.5 text-xs font-bold shadow-sm transition-all',
              hasValue
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
                : 'cursor-not-allowed bg-primary/30 text-primary-foreground',
            )}
          >
            Confirm
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
