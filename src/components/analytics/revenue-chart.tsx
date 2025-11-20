"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { RevenueDataPoint } from '@/lib/dashboard/queries'

interface RevenueChartProps {
  data: RevenueDataPoint[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value)
          }
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length && payload[0]) {
              const data = payload[0].payload as RevenueDataPoint
              return (
                <div className="rounded-lg border bg-background p-3 shadow-md">
                  <div className="text-sm font-medium">{data.month}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-muted-foreground">Revenue:</span>
                      <span className="text-sm font-bold">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format(data.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-muted-foreground">Bookings:</span>
                      <span className="text-sm font-medium">{data.bookings}</span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
