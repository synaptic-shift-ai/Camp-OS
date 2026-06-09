'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

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

  return (
    <div className="flex items-start gap-1.5 text-right">
      <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="text-sm font-medium tabular-nums" suppressHydrationWarning>
          {new Intl.DateTimeFormat(tz, {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
          }).format(now)}
        </span>
        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
          {new Intl.DateTimeFormat(tz, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }).format(now)}
        </span>
      </div>
    </div>
  )
}
