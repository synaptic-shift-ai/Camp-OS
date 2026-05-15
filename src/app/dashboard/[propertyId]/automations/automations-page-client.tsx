"use client"

import { useState, useRef, useLayoutEffect, useEffect, useCallback, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'
import { DashboardSummaryCards } from '@/components/dashboard/automations/dashboard-summary-cards'
import { PhaseDistribution } from '@/components/dashboard/automations/phase-distribution'
import { RecentExecutionActivity } from '@/components/dashboard/automations/recent-execution-activity'
import { ExecutionLogViewer } from '@/components/dashboard/automations/execution-log-viewer'
import { AutomationBuilder } from '@/components/dashboard/automations/automation-builder'
import { EmailTemplatesList } from '@/components/dashboard/automations/email-templates-list'
import { SmsTemplatesList } from '@/components/dashboard/automations/sms-templates-list'
import { ValidationTab } from '@/components/dashboard/automations/validation-tab'
import type { ExecutionLogRow } from '@/lib/automations/queries'
import type { AutomationExecutionLogRow, AutomationPhase, AutomationRow } from '@/lib/automations/types'

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
  smsTemplates?: Array<Record<string, unknown>>
  systemAutomationsList?: AutomationRow[]
}

const TAB_ITEMS = [
  { value: 'dashboard', label: 'Dashboard', permission: 'automations.view_dashboard' },
  { value: 'automations', label: 'Automations', permission: 'automations.view_automations' },
  { value: 'execution-log', label: 'Execution Logs', permission: 'automations.view_execution_log' },
  { value: 'validation', label: 'Validation', permission: 'automations.view_validation' },
  { value: 'email-templates', label: 'Email Templates', permission: 'automations.view_email_templates' },
  { value: 'sms-templates', label: 'SMS Templates', permission: 'automations.view_sms_templates' },
  { value: 'system-automations', label: 'System Automations', permission: 'automations.view_system_automations' },
] as const

const TAB_BUTTON_CLASS =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function AutomationsPageClient(data: AutomationsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [navigating, setNavigating] = useState(false)
  const { can, isLoading: permsLoading } = usePermissions()

  const visibleTabs = useMemo(() => {
    if (permsLoading) return TAB_ITEMS
    return TAB_ITEMS.filter(tab => can(tab.permission))
  }, [can, permsLoading])

  // Redirect to first visible tab if current tab is no longer accessible
  useEffect(() => {
    if (permsLoading || visibleTabs.length === 0) return
    if (!visibleTabs.some(t => t.value === data.activeTab)) {
      const params = new URLSearchParams(searchParams.toString())
      const first = visibleTabs[0].value
      if (first === 'dashboard') {
        params.delete('tab')
      } else {
        params.set('tab', first)
      }
      const q = params.toString()
      router.push(q ? `${pathname}?${q}` : pathname)
    }
  }, [permsLoading, visibleTabs, data.activeTab, searchParams, pathname, router])

  // Reset loading when server delivers new tab data
  useEffect(() => {
    setNavigating(false)
  }, [data.activeTab])

  // Responsive tab bar state
  const [visibleCount, setVisibleCount] = useState<number>(visibleTabs.length)
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
    const widths = visibleTabs.map((_, i) => {
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
      setVisibleCount(visibleTabs.length)
      return
    }

    let best = 0
    for (let k = 0; k < visibleTabs.length; k++) {
      const sumVisible = widths.slice(0, k).reduce((a, b) => a + b, 0) + (k > 0 ? (k - 1) * 4 : 0)
      const used = sumVisible + (k > 0 ? 4 : 0) + moreW
      if (used <= inner) best = k
    }
    setVisibleCount(best)
  }, [visibleTabs])

  useLayoutEffect(() => { measure() }, [measure])

  useEffect(() => {
    const el = rowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const safeVisible = Math.min(visibleCount, visibleTabs.length)
  const visibleItems = visibleTabs.slice(0, safeVisible)
  const overflowItems = visibleTabs.slice(safeVisible)
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
            {visibleTabs.map((item, i) => (
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

        {visibleTabs.some(t => t.value === 'dashboard') && (
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
        )}

        {visibleTabs.some(t => t.value === 'automations') && (
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
        )}

        {visibleTabs.some(t => t.value === 'system-automations') && (
        <TabsContent value="system-automations" className={navigating ? 'hidden' : undefined}>
          {data.systemAutomationsList ? (
            <AutomationBuilder
              automations={data.systemAutomationsList}
              propertyId={data.propertyId ?? ''}
              companyId={data.companyId ?? ''}
              systemMode
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading system automations…</p>
            </div>
          )}
        </TabsContent>
        )}

        {visibleTabs.some(t => t.value === 'execution-log') && (
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
        )}

        {visibleTabs.some(t => t.value === 'validation') && (
        <TabsContent value="validation" className={navigating ? 'hidden' : undefined}>
          {data.propertyId ? (
            <ValidationTab propertyId={data.propertyId} />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading validation…</p>
            </div>
          )}
        </TabsContent>
        )}

        {visibleTabs.some(t => t.value === 'email-templates') && (
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
        )}

        {visibleTabs.some(t => t.value === 'sms-templates') && (
        <TabsContent value="sms-templates" className={navigating ? 'hidden' : undefined}>
          {data.propertyId && data.companyId ? (
            <SmsTemplatesList
              templates={(data.smsTemplates as any[]) ?? []}
              propertyId={data.propertyId}
              companyId={data.companyId}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading SMS templates…</p>
            </div>
          )}
        </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
