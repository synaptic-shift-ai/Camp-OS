"use client"

import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DashboardSummaryCards } from '@/components/dashboard/automations/dashboard-summary-cards'
import { PhaseDistribution } from '@/components/dashboard/automations/phase-distribution'
import { RecentExecutionActivity } from '@/components/dashboard/automations/recent-execution-activity'
import { ExecutionLogViewer } from '@/components/dashboard/automations/execution-log-viewer'
import { AutomationBuilder } from '@/components/dashboard/automations/automation-builder'
import { EmailTemplatesList } from '@/components/dashboard/automations/email-templates-list'
import { ValidationTab } from '@/components/dashboard/automations/validation-tab'
import type { ExecutionLogRow } from '@/lib/automations/queries'

type AutomationsDashboardData = {
  propertyName: string
  totalAutomations: number
  activeCount: number
  inactiveCount: number
  phaseDistribution: Array<{ phase: AutomationPhase; count: number }>
  executionSummary: { passed: number; failed: number; skipped: number; total: number }
  recentLogs: AutomationExecutionLogRow[]
}

type ExecutionLogData = {
  logs: ExecutionLogRow[]
  automations: Array<{ id: string; name: string }>
  total: number
  currentPage: number
  pageSize: number
  sortBy: string
  sortOrder: string
  filters: {
    automationId?: string
    outcome?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  }
}

type AutomationsPageClientProps = AutomationsDashboardData & {
  executionLogData?: ExecutionLogData
  activeTab: string
  propertyId?: string
  companyId?: string
  automationsList?: AutomationRow[]
  emailTemplates?: Array<Record<string, unknown>>
}

const TAB_ITEMS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'automations', label: 'Automations' },
  { value: 'execution-log', label: 'Execution Logs' },
  { value: 'validation', label: 'Validation' },
  { value: 'email-templates', label: 'Email Templates' },
] as const

const TAB_BUTTON_CLASS =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function AutomationsPageClient(data: AutomationsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [navigating, setNavigating] = useState(false)

  // Reset loading when server delivers new tab data
  useEffect(() => {
    setNavigating(false)
  }, [data.activeTab])

  // Responsive tab bar state
  const [visibleCount, setVisibleCount] = useState(TAB_ITEMS.length)
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRefs = useRef<(HTMLButtonElement | null)[]>([])
  const moreRef = useRef<HTMLButtonElement>(null)

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "dashboard") {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    const q = params.toString()
    setNavigating(true)
    router.push(q ? `${pathname}?${q}` : pathname)
  }

  const measure = useCallback(() => {
    const widths = TAB_ITEMS.map((_, i) => {
      const el = measureRefs.current[i]
      return el ? Math.ceil(el.getBoundingClientRect().width) : 0
    })
    const moreW = moreRef.current
      ? Math.ceil(moreRef.current.getBoundingClientRect().width)
      : 80
    const rowEl = rowRef.current
    if (!rowEl || widths.some(w => w <= 0)) return

    const inner = rowEl.clientWidth - 8 // padding
    if (inner <= 0) return

    const allFit = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 4
    if (allFit <= inner) {
      setVisibleCount(TAB_ITEMS.length)
      return
    }

    let best = 0
    for (let k = 0; k < TAB_ITEMS.length; k++) {
      const sumVisible = widths.slice(0, k).reduce((a, b) => a + b, 0) + (k > 0 ? (k - 1) * 4 : 0)
      const used = sumVisible + (k > 0 ? 4 : 0) + moreW
      if (used <= inner) best = k
    }
    setVisibleCount(best)
  }, [])

  useLayoutEffect(() => { measure() }, [measure])

  useEffect(() => {
    const el = rowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const safeVisible = Math.min(visibleCount, TAB_ITEMS.length)
  const visibleItems = TAB_ITEMS.slice(0, safeVisible)
  const overflowItems = TAB_ITEMS.slice(safeVisible)
  const hasOverflow = overflowItems.length > 0
  const overflowSelected = overflowItems.some(item => item.value === data.activeTab)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
        <p className="text-muted-foreground">Manage and monitor your property automation rules.</p>
      </div>

      <Tabs value={data.activeTab} onValueChange={handleTabChange} className="space-y-6">
        {/* Responsive tab bar */}
        <div ref={rowRef} className="relative w-full min-w-0">
          {/* Hidden measurement buttons */}
          <div className="pointer-events-none fixed -left-[10000px] top-0 z-[-1] flex flex-row gap-1 opacity-0" aria-hidden>
            {TAB_ITEMS.map((item, i) => (
              <button
                key={item.value}
                ref={el => { measureRefs.current[i] = el }}
                type="button"
                className={TAB_BUTTON_CLASS}
              >
                {item.label}
              </button>
            ))}
            <button ref={moreRef} type="button" className={cn(TAB_BUTTON_CLASS, 'gap-1')}>
              More
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>
          </div>

          {/* Visible tab bar */}
          <div className="inline-flex h-auto min-h-10 w-fit max-w-full min-w-0 flex-nowrap justify-start gap-1 rounded-md bg-muted p-1 text-muted-foreground">
            {visibleItems.map(item => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  TAB_BUTTON_CLASS,
                  item.value === data.activeTab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:text-foreground'
                )}
                onClick={() => handleTabChange(item.value)}
              >
                {item.label}
              </button>
            ))}
            {hasOverflow && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      TAB_BUTTON_CLASS,
                      'group gap-1',
                      overflowSelected
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    More
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[10rem]">
                  {overflowItems.map(item => (
                    <DropdownMenuItem
                      key={item.value}
                      className={cn(item.value === data.activeTab && 'font-medium text-primary')}
                      onSelect={() => handleTabChange(item.value)}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {navigating && (
          <div className="relative flex items-center justify-center h-64">
            <div className="absolute inset-0 z-20 bg-background/60 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <TabsContent value="dashboard" className={navigating ? 'hidden' : 'space-y-6'}>
          <DashboardSummaryCards
            totalAutomations={data.totalAutomations}
            activeCount={data.activeCount}
            inactiveCount={data.inactiveCount}
          />
          <PhaseDistribution distribution={data.phaseDistribution} />
          <RecentExecutionActivity
            executionSummary={data.executionSummary}
            recentLogs={data.recentLogs}
          />
        </TabsContent>

        <TabsContent value="automations" className={navigating ? 'hidden' : undefined}>
          {data.automationsList && data.propertyId ? (
            <AutomationBuilder
              automations={data.automationsList}
              propertyId={data.propertyId}
              companyId={data.companyId ?? ''}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading automations…</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="execution-log" className={navigating ? 'hidden' : undefined}>
          {data.executionLogData ? (
            <ExecutionLogViewer
              logs={data.executionLogData.logs}
              automations={data.executionLogData.automations}
              total={data.executionLogData.total}
              currentPage={data.executionLogData.currentPage}
              pageSize={data.executionLogData.pageSize}
              sortBy={data.executionLogData.sortBy}
              sortOrder={data.executionLogData.sortOrder}
              filters={data.executionLogData.filters}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading execution logs…</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="validation" className={navigating ? 'hidden' : undefined}>
          {data.propertyId ? (
            <ValidationTab propertyId={data.propertyId} />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading validation…</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="email-templates" className={navigating ? 'hidden' : undefined}>
          {data.propertyId && data.companyId ? (
            <EmailTemplatesList
              templates={data.emailTemplates ?? []}
              propertyId={data.propertyId}
              companyId={data.companyId}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading email templates…</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
