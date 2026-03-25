'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type OverflowTabItem = {
  value: string
  label: string
  disabled?: boolean
}

const TAB_TRIGGER_CLASS =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm'

const TAB_LIST_HORIZONTAL_PADDING_PX = 8

const GAP_PX = 4

function computeVisibleCount(
  widths: number[],
  innerWidth: number,
  moreButtonWidth: number,
): number {
  const n = widths.length
  if (n === 0) return 0
  const sumAll = widths.reduce((a, b) => a + b, 0) + (n - 1) * GAP_PX
  if (sumAll <= innerWidth) return n

  let best = 0
  for (let k = 0; k < n; k++) {
    const sumVisible =
      widths.slice(0, k).reduce((a, b) => a + b, 0) + (k - 1) * GAP_PX
    const used = sumVisible + (k > 0 ? GAP_PX : 0) + moreButtonWidth
    if (used <= innerWidth) best = k
  }
  return best
}

type OverflowTabsProps = {
  defaultValue: string
  items: OverflowTabItem[]
  className?: string
  tabListClassName?: string
  children: React.ReactNode
}

export function OverflowTabs({
  defaultValue,
  items,
  className,
  tabListClassName,
  children,
}: OverflowTabsProps) {
  const [value, setValue] = React.useState(defaultValue)
  const [visibleCount, setVisibleCount] = React.useState(items.length)

  const rowWidthRef = React.useRef<HTMLDivElement>(null)
  const measureElsRef = React.useRef<(HTMLButtonElement | null)[]>([])
  const moreMeasureRef = React.useRef<HTMLButtonElement>(null)

  const itemsKey = items.map((i) => `${i.value}:${i.label}:${i.disabled ? 1 : 0}`).join('|')

  const measureWidths = React.useCallback(() => {
    const widths = items.map((_, i) => {
      const el = measureElsRef.current[i]
      return el ? Math.ceil(el.getBoundingClientRect().width) : 0
    })
    const moreW = moreMeasureRef.current
      ? Math.ceil(moreMeasureRef.current.getBoundingClientRect().width)
      : 72
    const rowEl = rowWidthRef.current
    if (!rowEl || widths.some((w) => w <= 0)) return

    const inner = rowEl.clientWidth - TAB_LIST_HORIZONTAL_PADDING_PX
    if (inner <= 0) return

    const next = computeVisibleCount(widths, inner, moreW)
    setVisibleCount((prev) => (prev === next ? prev : next))
  }, [items, itemsKey])

  React.useLayoutEffect(() => {
    measureWidths()
  }, [measureWidths])

  React.useEffect(() => {
    const el = rowWidthRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      measureWidths()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [measureWidths])

  const safeVisible = Math.min(visibleCount, items.length)
  const visibleItems = items.slice(0, safeVisible)
  const overflowItems = items.slice(safeVisible)
  const hasOverflow = overflowItems.length > 0
  const overflowSelected = overflowItems.some((item) => item.value === value)

  return (
    <Tabs value={value} onValueChange={setValue} className={className}>
      <div ref={rowWidthRef} className="relative w-full min-w-0">
        <div
          className="pointer-events-none fixed -left-[10000px] top-0 z-[-1] flex flex-row gap-1 opacity-0"
          aria-hidden
        >
          {items.map((item, i) => (
            <button
              key={item.value}
              ref={(el) => {
                measureElsRef.current[i] = el
              }}
              type="button"
              className={TAB_TRIGGER_CLASS}
            >
              {item.label}
            </button>
          ))}
          <button ref={moreMeasureRef} type="button" className={cn(TAB_TRIGGER_CLASS, 'gap-1')}>
            More
            <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
          </button>
        </div>

        <TabsList
          className={cn(
            'inline-flex h-auto min-h-10 w-fit max-w-full min-w-0 flex-nowrap justify-start gap-1 p-1',
            tabListClassName,
          )}
        >
          {visibleItems.map((item) => (
            <TabsTrigger key={item.value} value={item.value} disabled={item.disabled === true}>
              {item.label}
            </TabsTrigger>
          ))}
          {hasOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    TAB_TRIGGER_CLASS,
                    'group gap-1 text-muted-foreground hover:text-foreground',
                    overflowSelected && 'bg-background text-foreground shadow-sm',
                  )}
                >
                  More
                  <ChevronDown
                    className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[10rem]">
                {overflowItems.map((item) => (
                  <DropdownMenuItem
                    key={item.value}
                    disabled={item.disabled === true}
                    className={cn(
                      item.value === value && 'font-medium text-primary',
                    )}
                    onSelect={() => {
                      if (!item.disabled) setValue(item.value)
                    }}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TabsList>
      </div>
      {children}
    </Tabs>
  )
}
