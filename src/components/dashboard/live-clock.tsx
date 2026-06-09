'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock } from 'lucide-react'

interface LiveClockProps {
  timezone?: string
}

export function LiveClock({ timezone }: LiveClockProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const tz = timezone || undefined
  const timeOptions = tz ? { timeZone: tz } : {}

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...timeOptions,
  })

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...timeOptions,
  })

  return (
    <div className="flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 shadow-sm">
      <Calendar className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm font-medium whitespace-nowrap" suppressHydrationWarning>
        {dateFormatter.format(now)}
      </span>
      <div className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-medium tabular-nums whitespace-nowrap" suppressHydrationWarning>
        {timeFormatter.format(now)}
      </span>
    </div>
  )
}
