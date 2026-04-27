'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  ClipboardList,
  Wrench,
  CheckCircle2,
  DollarSign,
  FileX2,
  ExternalLink,
  Download,
  CalendarIcon,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { toast } from 'sonner'
import { BudgetManagement } from './budget-management'
import { exportToCsv, buildExportFilename } from '@/lib/csv/export'
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
  vendorBreakdown: Array<{ vendorName: string; totalCost: number }>
  monthlyTrend: Array<{ month: string; totalCost: number }>
  budgetComparison: Array<{
    category: string
    period: string
    budgetAmount: number
    actualSpend: number
    remaining: number
  }>
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

const VENDOR_COLORS = [
  'hsl(var(--primary))',
  'hsl(215, 20%, 65%)',
  'hsl(142, 71%, 45%)',
  'hsl(25, 95%, 53%)',
  'hsl(280, 50%, 60%)',
  'hsl(340, 70%, 50%)',
]

function formatCurrency(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(Number(year), Number(monthNum) - 1, 1)
  return format(date, 'MMM yyyy')
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
  const [dateFrom, setDateFrom] = useState<Date>(() => subDays(new Date(), 30))
  const [dateTo, setDateTo] = useState<Date>(new Date())
  const [fromPickerOpen, setFromPickerOpen] = useState(false)
  const [toPickerOpen, setToPickerOpen] = useState(false)

  // ---- data fetching -------------------------------------------------------
  const fetchReport = useCallback(async () => {
    const fromStr = format(dateFrom, 'yyyy-MM-dd')
    const toStr = format(dateTo, 'yyyy-MM-dd')

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
  }, [propertyId, dateFrom, dateTo])

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

  const vendorChartData = useMemo(() => {
    if (!reportData) return []
    return reportData.vendorBreakdown.map((item) => ({
      vendorName: item.vendorName,
      totalCost: item.totalCost,
    }))
  }, [reportData])

  const monthlyTrendData = useMemo(() => {
    if (!reportData) return []
    return reportData.monthlyTrend.map((item) => ({
      month: formatMonth(item.month),
      totalCost: item.totalCost,
    }))
  }, [reportData])

  const formattedCost = useMemo(() => {
    const dollars = reportData?.totalEstimatedCost ?? 0
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }, [reportData])

  const hasData = reportData && reportData.totalWorkOrders > 0
  const hasVendorData = vendorChartData.length > 0
  const hasMonthlyData = monthlyTrendData.length > 0
  const hasBudgetData = (reportData?.budgetComparison ?? []).length > 0

  // ---- CSV export ----------------------------------------------------------
  const handleExportCsv = useCallback(() => {
    if (!reportData) return

    const rows: Array<Record<string, unknown>> = []

    // Stat rows
    rows.push({ Section: 'Summary', Metric: 'Total Work Orders', Value: reportData.totalWorkOrders })
    rows.push({ Section: 'Summary', Metric: 'Active Work Orders', Value: reportData.activeWorkOrders })
    rows.push({ Section: 'Summary', Metric: 'Completed Work Orders', Value: reportData.completedWorkOrders })
    rows.push({ Section: 'Summary', Metric: 'Total Estimated Cost', Value: reportData.totalEstimatedCost })

    // Vendor breakdown
    for (const v of reportData.vendorBreakdown) {
      rows.push({ Section: 'Vendor Breakdown', Metric: v.vendorName, Value: v.totalCost })
    }

    // Monthly trend
    for (const m of reportData.monthlyTrend) {
      rows.push({ Section: 'Monthly Trend', Metric: formatMonth(m.month), Value: m.totalCost })
    }

    exportToCsv(
      buildExportFilename(`maintenance-report-${propertyId}`),
      rows,
      [
        { key: 'Section', header: 'Section' },
        { key: 'Metric', header: 'Metric' },
        { key: 'Value', header: 'Value' },
      ],
    )
    toast.success('CSV exported')
  }, [reportData, propertyId])

  // ---- render helpers ------------------------------------------------------
  const renderStatCards = () => (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
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

  const renderBudgetTable = () => {
    if (!hasBudgetData) return null
    return (
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-medium">Budget vs Actual</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Budget</th>
                <th className="px-3 py-2 text-right font-medium">Actual</th>
                <th className="px-3 py-2 text-right font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.budgetComparison.map((row, i) => {
                const isOver = row.remaining < 0
                return (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 capitalize">
                      {(row.category ?? 'other').replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{row.period}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.budgetAmount)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.actualSpend)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${isOver ? 'text-red-600' : 'text-emerald-700'}`}>
                      {isOver
                        ? `−${formatCurrency(Math.abs(row.remaining))}`
                        : formatCurrency(row.remaining)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  // ---- render --------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cost Report — {propertyName}</h2>
          <p className="text-sm text-muted-foreground">
            Maintenance work order analytics and cost summary
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onViewAllWorkOrders ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-border bg-card/80 font-sans text-foreground hover:bg-card"
              onClick={onViewAllWorkOrders}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">View all work orders</span>
              <span className="sm:hidden">WOs</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Date range picker + export */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={fromPickerOpen} onOpenChange={setFromPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-sm font-normal">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(dateFrom, 'MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(d) => { if (d) { setDateFrom(d); setFromPickerOpen(false) } }}
            />
          </PopoverContent>
        </Popover>
        <span className="text-sm text-muted-foreground">to</span>
        <Popover open={toPickerOpen} onOpenChange={setToPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-sm font-normal">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(dateTo, 'MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(d) => { if (d) { setDateTo(d); setToPickerOpen(false) } }}
            />
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExportCsv}
          disabled={isLoading || !reportData}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
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
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-2 sm:p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
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
            <p className="text-sm">No work orders in the selected date range</p>
          </div>
        </>
      ) : (
        /* ---- Data state ---- */
        <>
          {renderStatCards()}

          {/* Charts */}
          {hasData && (
            <div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
              {/* By Status */}
              <Card className="p-4">
                <h3 className="mb-4 text-sm font-medium">Work Orders by Status</h3>
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
                <h3 className="mb-4 text-sm font-medium">Work Orders by Category</h3>
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

          {/* Vendor breakdown chart */}
          {hasVendorData && (
            <Card className="p-4 mt-4">
              <h3 className="mb-4 text-sm font-medium">Spend by Vendor</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="vendorName" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="totalCost" radius={[4, 4, 0, 0]}>
                    {vendorChartData.map((_, index) => (
                      <Cell key={index} fill={VENDOR_COLORS[index % VENDOR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Monthly trend chart */}
          {hasMonthlyData && (
            <Card className="p-4 mt-4">
              <h3 className="mb-4 text-sm font-medium">Monthly Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="totalCost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Budget vs actual table */}
          {renderBudgetTable()}

          {/* Budget Management */}
          <BudgetManagement propertyId={propertyId} />
        </>
      )}
    </div>
  )
}
