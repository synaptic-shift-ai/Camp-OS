'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  ClipboardList,
  Wrench,
  CheckCircle2,
  DollarSign,
  FileX2,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportData {
  totalWorkOrders: number
  activeWorkOrders: number
  completedWorkOrders: number
  totalEstimatedCost: number
  byStatus: Array<{ status: string; count: number }>
  byCategory: Array<{ category: string; count: number }>
  byPriority: Array<{ priority: string; count: number }>
}

interface CostReportProps {
  propertyId: string
  propertyName: string
  onViewAllWorkOrders?: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  open: 'hsl(var(--primary))',
  in_progress: 'hsl(215, 20%, 65%)',
  completed: 'hsl(142, 71%, 45%)',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostReport({
  propertyId,
  propertyName,
  onViewAllWorkOrders,
}: CostReportProps) {
  // ---- state ---------------------------------------------------------------
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---- data fetching -------------------------------------------------------
  const fetchReport = useCallback(async () => {
    const to = new Date()
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const fromStr = from.toISOString().split('T')[0]
    const toStr = to.toISOString().split('T')[0]

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/reports?from=${fromStr}&to=${toStr}`,
      )

      if (!response.ok) {
        throw new Error(`Failed to load report (${response.status})`)
      }

      const payload = await response.json()

      if (!payload?.success) {
        throw new Error(payload?.error?.message ?? 'Failed to load report')
      }

      setReportData(payload.data as ReportData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load report'
      setError(message)
      toast.error('Unable to load maintenance report', { description: message })
    } finally {
      setIsLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  // ---- derived chart data --------------------------------------------------
  const statusChartData = useMemo(() => {
    if (!reportData) return []
    return reportData.byStatus.map((item) => ({
      key: item.status,
      label: STATUS_LABELS[item.status] ?? item.status,
      count: item.count,
    }))
  }, [reportData])

  const categoryChartData = useMemo(() => {
    if (!reportData) return []
    return reportData.byCategory.map((item) => ({
      category: item.category,
      count: item.count,
    }))
  }, [reportData])

  const formattedCost = useMemo(() => {
    const dollars = reportData?.totalEstimatedCost ?? 0
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }, [reportData])

  const hasData = reportData && reportData.totalWorkOrders > 0

  // ---- render helpers ------------------------------------------------------
  const renderStatCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
      <Card className="p-2 sm:p-4">
        <CardHeader className="p-2 pb-1 sm:p-4 sm:pb-2 flex flex-row items-center justify-between">
          <span className="text-[9px] sm:text-sm text-muted-foreground">Total Work Orders</span>
          <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-2 pt-0 pb-2 sm:p-4">
          <span className="text-xl sm:text-2xl font-semibold">
            {reportData?.totalWorkOrders ?? 0}
          </span>
        </CardContent>
      </Card>

      <Card className="p-2 sm:p-4">
        <CardHeader className="p-2 pb-1 sm:p-4 sm:pb-2 flex flex-row items-center justify-between">
          <span className="text-[9px] sm:text-sm text-muted-foreground">Active</span>
          <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0 pb-2 sm:p-4">
          <span className="text-xl sm:text-2xl font-semibold text-orange-500">
            {reportData?.activeWorkOrders ?? 0}
          </span>
        </CardContent>
      </Card>

      <Card className="p-2 sm:p-4">
        <CardHeader className="p-2 pb-1 sm:p-4 sm:pb-2 flex flex-row items-center justify-between">
          <span className="text-[9px] sm:text-sm text-muted-foreground">Completed</span>
          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
        </CardHeader>
        <CardContent className="p-2 pt-0 pb-2 sm:p-4">
          <span className="text-xl sm:text-2xl font-semibold text-green-600">
            {reportData?.completedWorkOrders ?? 0}
          </span>
        </CardContent>
      </Card>

      <Card className="p-2 sm:p-4">
        <CardHeader className="p-2 pb-1 sm:p-4 sm:pb-2 flex flex-row items-center justify-between">
          <span className="text-[9px] sm:text-sm text-muted-foreground">Total Cost</span>
          <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
        </CardHeader>
        <CardContent className="p-2 pt-0 pb-2 sm:p-4">
          <span className="text-xl sm:text-2xl font-semibold text-primary">{formattedCost}</span>
        </CardContent>
      </Card>
    </div>
  )

  // ---- render --------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cost Report — {propertyName}</h2>
          <p className="text-sm text-muted-foreground">
            Maintenance work order analytics and cost summary
          </p>
        </div>
        {onViewAllWorkOrders ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-full border-border bg-card/80 font-sans text-foreground hover:bg-card"
            onClick={onViewAllWorkOrders}
          >
            View all work orders
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        /* ---- Loading state ---- */
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-2 sm:p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-muted animate-pulse h-[300px]" />
            ))}
          </div>
        </>
      ) : reportData && reportData.totalWorkOrders === 0 ? (
        /* ---- Empty state ---- */
        <>
          {renderStatCards()}
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileX2 className="h-12 w-12 mb-4" />
            <p className="text-sm">No work orders in the last 30 days</p>
          </div>
        </>
      ) : (
        /* ---- Data state ---- */
        <>
          {renderStatCards()}

          {/* Charts */}
          {hasData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* By Status */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-4">Work Orders by Status</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {statusChartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={STATUS_COLORS[entry.key] ?? 'hsl(var(--primary))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* By Category */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-4">Work Orders by Category</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={categoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
